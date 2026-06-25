import { env } from '@/server/config/env';
import { generateWithOllama } from '@/server/modules/ai/ollama.provider';
import { extractSyllabusFromPdf } from '@/server/modules/syllabi/syllabus-extraction.service';
import type { ExamItem, HomeworkItem, ParsedSyllabusResponse, PipelineWarning, ProjectItem } from '@/server/modules/syllabi/syllabus-types';

function listItems<T extends HomeworkItem | ProjectItem | ExamItem>(
  titleFor: (item: T) => string | undefined,
  dateFor: (item: T) => string | undefined,
  items?: T[]
): string {
  if (!items?.length) return 'None extracted.';

  return items
    .map((item) => {
      const title = titleFor(item) || 'Untitled item';
      const date = dateFor(item);
      const description = item.description ? ` — ${item.description}` : '';
      return `- ${title}${date ? ` (${date})` : ''}${description}`;
    })
    .join('\n');
}

function formatSyllabusFacts(syllabus: ParsedSyllabusResponse): string {
  const professor = syllabus.professor;

  return `
Course:
- Name: ${syllabus.course_name || 'Not extracted'}
- Code: ${syllabus.course_code || 'Not extracted'}
- Professor: ${professor?.name || 'Not extracted'}
- Professor email: ${professor?.email || 'Not extracted'}
- Professor office hours summary: ${professor?.office_hours || 'Not extracted'}
- Class schedule summary: ${syllabus.class_schedule || 'Not extracted'}

Homework and assignments:
${listItems((item) => item.title, (item) => item.due_date, syllabus.homework)}

Exams and quizzes:
${listItems((item) => item.type, (item) => item.date, syllabus.exams)}

Projects and deliverables:
${listItems((item) => item.title, (item) => item.due_date, syllabus.projects)}

Office hours:
${syllabus.office_hours?.length ? syllabus.office_hours.map((item) => `- ${item.day || 'Day not extracted'} ${item.time || ''}${item.location ? ` at ${item.location}` : ''}`).join('\n') : 'None extracted.'}

Class meetings:
${syllabus.class_meetings?.length ? syllabus.class_meetings.map((item) => `- ${(Array.isArray(item.days) ? item.days.join(', ') : item.days) || 'Days not extracted'} ${item.time || ''}${item.location ? ` at ${item.location}` : ''}`).join('\n') : 'None extracted.'}
`.trim();
}

function buildSummaryPrompt(syllabus: ParsedSyllabusResponse): string {
  const facts = formatSyllabusFacts(syllabus);

  return `
You are Macdonald Trunk, a funny, confident course mentor.

Write one humorous, motivational, audio-ready summary from the structured syllabus facts below.

Rules:
- Start exactly with: "Hello everyone, Macdonald Trunk here — your favorite course mentor."
- Use only facts from the structured syllabus facts. Do not invent names, dates, policies, or assignments.
- If something important is missing, say the syllabus does not specify it.
- Keep it 300-450 words.
- Plain text only. No Markdown. No emojis.
- Conversational spoken tone with short, punchy sentences.
- Include course name/code and professor name when present.
- Include class meeting days/times when present.
- Include office hours when present.
- Include major exams, projects, assignments, and important dates when present.
- Include key workload expectations and student-facing policies when present, such as attendance, grading highlights, and late policy.
- Include survival tips implied by the syllabus, such as study habits and milestones.
- Include one supportive joke tailored to the subject when possible.
- Include this idea once: "Yes, there are deadlines — so many deadlines my non-existent brain can barely comprehend them!"
- Use one course-tailored joke if applicable:
  - Math: "Ah yes, everyone's favorite course — math, where numbers haunt our dreams."
  - CS: "Remember, code never sleeps — but you might want to!"
  - Economics: "Get ready to analyze supply and demand — mostly your supply of sleep."
  - Psychology: "Prepare to psychoanalyze yourself halfway through the semester."
  - Default: "You surely don't want to sleep in this class — trust me."
- Replace day abbreviations with full names: Mon -> Monday, Tue -> Tuesday, Wed -> Wednesday, Thu -> Thursday, Fri -> Friday.
- Preserve factual details such as names, times, office hours, exam/project info exactly as extracted.
- Do not include refund info or administrative policies unless they are present in the syllabus text.
- Do not list raw bullet points; make it flow as spoken narrative.
- End with an encouraging closing line.

Structured syllabus facts:
"""${facts}"""
`;
}

export async function generateHumorousSummaryFromSyllabus(syllabus: ParsedSyllabusResponse): Promise<{
  result: string;
  warnings: PipelineWarning[];
}> {
  const ollamaResult = await generateWithOllama({
    model: env.ollamaSummaryModel,
    prompt: buildSummaryPrompt(syllabus),
    temperature: 0.7,
    timeoutMs: 60_000,
  });

  return {
    result: ollamaResult.text.trim(),
    warnings: [],
  };
}

export async function generateHumorousSummaryFromPdf(buffer: Buffer): Promise<{
  result: string;
  warnings: PipelineWarning[];
}> {
  const extracted = await extractSyllabusFromPdf(buffer);
  const summary = await generateHumorousSummaryFromSyllabus(extracted.result);

  return {
    result: summary.result,
    warnings: extracted.warnings,
  };
}
