import { env } from '@/server/config/env';
import { badRequest } from '@/server/http/api-error';
import { generateWithOllama } from '@/server/modules/ai/ollama.provider';
import { extractPdfText } from '@/server/modules/files/pdf-text-extractor';
import type { ExamItem, HomeworkItem, ParsedSyllabusResponse, PipelineWarning, ProjectItem } from './syllabus-types';
import { normalizeSyllabusResponse } from './syllabus-normalizer';

const extractionJsonSchema = {
  type: 'object',
  properties: {
    course_name: { type: 'string' },
    course_code: { type: 'string' },
    professor: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        office_hours: { type: 'string' },
      },
    },
    class_schedule: { type: 'string' },
    homework: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          due_date: { type: 'string' },
          due_time: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    exams: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          due_date: { type: 'string' },
          due_time: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    office_hours: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string' },
          time: { type: 'string' },
          location: { type: 'string' },
          recurrence: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
        },
      },
    },
    class_meetings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          days: { type: 'array', items: { type: 'string' } },
          time: { type: 'string' },
          location: { type: 'string' },
          recurrence: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
        },
      },
    },
  },
};

const deadlineJsonSchema = {
  type: 'object',
  properties: {
    homework: extractionJsonSchema.properties.homework,
    exams: extractionJsonSchema.properties.exams,
    projects: extractionJsonSchema.properties.projects,
  },
};

function parseOllamaJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw badRequest('Ollama did not return valid syllabus JSON', { code: 'invalid_ollama_json' });
    }
    return JSON.parse(jsonMatch[0]) as T;
  }
}

function buildExtractionPrompt(text: string): string {
  return `
You are a meticulous syllabus parser for a calendar app. Extract ALL academic deadlines and recurring course meetings from the syllabus text.

Rules:
- Use only the provided syllabus text. Do not invent missing information.
- Return valid JSON only.
- Convert clear dates to YYYY-MM-DD.
- Infer the year from semester text such as Fall 2025, Spring 2026, or course schedule context.
- If a date is ambiguous or missing, omit that date field rather than inventing one.
- Preserve full assignment, exam, and project titles.
- Include all relevant deadlines from schedules, tables, grading sections, and calendar sections.
- Scan every section, especially weekly schedules, course calendars, assignment tables, grading tables, and "important dates".
- Treat these as homework when they have due dates: homework, HW, assignment, lab, quiz due, discussion post, reflection, report, survey, peer review, reading response, worksheet, sprint plan, sprint review, sprint retrospective.
- Treat these as projects when they have due dates: project, presentation, proposal, milestone, deliverable, demo, team formation.
- Treat these as exams when they have dates: exam, midterm, final, test, quiz, review.
- Do not skip items just because they appear inside a table or week-by-week schedule.

Critical date extraction rules adapted from the previous Gemini pipeline:
1. Find the year/semester first.
   - Look for terms like "Fall 2025", "Spring 2026", "Summer 2026", or standalone years in the header and schedule.
   - Use that year for month/day dates that do not include a year.
   - If the syllabus spans two calendar years, use the year that matches the semester month.

2. Scan all sections.
   - Course schedules, calendars, timelines.
   - Assignment tables and grading sections.
   - Important dates sections.
   - Week-by-week schedules.
   - Any table or list that contains dates.

3. Date format handling.
   - "August 23, 2025" -> "2025-08-23".
   - "Aug 23" with Fall 2025 context -> "2025-08-23".
   - "8/23/2025" -> "2025-08-23".
   - "8/23" with Fall 2025 context -> "2025-08-23".
   - "Dec 2" with Fall 2025 context -> "2025-12-02".
   - Date ranges like "8/18-8/22" -> use the END date when it is a deadline, "2025-08-22".
   - Week labels like "Week 3 (Sept 11)" -> extract "2025-09-11" if attached to coursework.
   - Never output "Invalid Date". Omit uncertain date fields instead.

4. Items to actively find.
   - ALL homework/assignments: HW1, HW2, Assignment 1, problem sets, worksheets.
   - ALL exams: Midterm, Final, Quiz 1, Test, Review.
   - ALL projects: Team Project, Individual Report, Presentation, Proposal, Demo.
   - Sprint plans, sprint reviews, retrospectives.
   - Surveys, evaluations, peer reviews.
   - Lab work, practicals, workshops.
   - Discussion posts, forums, reflections.
   - Office hours with weekly day/time/location when available.
   - Class meeting times such as "MW 2:00-3:15 PM" or "TTh 10:00-11:30 AM".

5. Title quality.
   - Use complete names: "Team Formation and Project Preferences", not "Team".
   - Include numbers: "Sprint 4 Individual Report", not "Individual Report".
   - Keep useful descriptive detail: "Self-intro and Project Preferences".

6. Common patterns to look for.
   - "Due:", "Due by:", "Due on:", "Deadline:", "Submit:", "Submission".
   - Dates next to assignment names in tables.
   - Calendar grids with dates and assignments.
   - Timeline formats.
   - Parenthetical dates like "Assignment 1 (Sept 15)".
   - Rows where one column is a week/date and another column contains assignments or deliverables.

Quality checks before returning:
- Did you check every section of the syllabus text?
- Did you include assignment numbers and sprint/report numbers?
- Did you check tables, schedules, and calendar sections?
- If this is a full semester course, there are often 5-10+ dated items. Re-scan before returning empty arrays.
- Only leave homework/exams/projects empty if the text truly contains no dated coursework.

Required JSON shape:
{
  "course_name": "string",
  "course_code": "string",
  "professor": { "name": "string", "email": "string", "office_hours": "string" },
  "class_schedule": "string",
  "homework": [{ "title": "string", "due_date": "YYYY-MM-DD", "due_time": "string", "description": "string" }],
  "exams": [{ "type": "string", "date": "YYYY-MM-DD", "time": "string", "description": "string" }],
  "projects": [{ "title": "string", "due_date": "YYYY-MM-DD", "due_time": "string", "description": "string" }],
  "office_hours": [{ "day": "string", "time": "string", "location": "string", "recurrence": "weekly", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }],
  "class_meetings": [{ "days": ["string"], "time": "string", "location": "string", "recurrence": "weekly", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }]
}

Syllabus text:
"""${text}"""
`;
}

function buildDeadlineRescuePrompt(text: string): string {
  return `
You are doing a second-pass deadline extraction from syllabus text. Your only job is to find dated coursework that may have been missed.

Return valid JSON only with exactly these keys: homework, exams, projects.

Find every item with a due date or scheduled date:
- homework/HW/assignment/lab/discussion/reflection/report/survey/peer review/worksheet/reading response/sprint plan/sprint review/sprint retrospective
- project/proposal/milestone/deliverable/demo/presentation/team formation
- exam/midterm/final/test/quiz

Rules:
- Scan tables, weekly schedules, course calendars, grading sections, and important dates.
- Preserve complete item titles.
- Convert clear dates to YYYY-MM-DD using the semester/year context.
- If a date has no year but the syllabus clearly states the semester year, use that year.
- If a date is unclear, include the item with description but omit the date.
- Do not include office hours or regular class meetings.
- Be aggressive about finding coursework in table rows. A row like "Week 4 | Sept 11 | Sprint 1 Individual Report" is a dated project/homework item.
- Treat "review", "retrospective", "peer evaluation", "survey", and "presentation" as coursework when tied to a date.
- If a row has a date column and an activities/deliverables column, connect the date to the deliverable.
- Re-check for common patterns: "Due", "Submit", "Assignment", "HW", "Lab", "Quiz", "Exam", "Project", "Report", "Sprint", "Reflection", "Discussion".

JSON shape:
{
  "homework": [{ "title": "string", "due_date": "YYYY-MM-DD", "due_time": "string", "description": "string" }],
  "exams": [{ "type": "string", "date": "YYYY-MM-DD", "time": "string", "description": "string" }],
  "projects": [{ "title": "string", "due_date": "YYYY-MM-DD", "due_time": "string", "description": "string" }]
}

Syllabus text:
"""${text}"""
`;
}

function itemKey(item: HomeworkItem | ProjectItem | ExamItem, kind: 'homework' | 'project' | 'exam'): string {
  const title = kind === 'exam' ? (item as ExamItem).type : (item as HomeworkItem | ProjectItem).title;
  const date = kind === 'exam' ? (item as ExamItem).date : (item as HomeworkItem | ProjectItem).due_date;
  return `${kind}:${(title || '').toLowerCase().trim()}:${date || ''}`;
}

function mergeUniqueItems<T extends HomeworkItem | ProjectItem | ExamItem>(
  primary: T[] | undefined,
  secondary: T[] | undefined,
  kind: 'homework' | 'project' | 'exam'
): T[] {
  const merged: T[] = [];
  const seen = new Set<string>();

  for (const item of [...(primary || []), ...(secondary || [])]) {
    const key = itemKey(item, kind);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export async function extractSyllabusFromPdf(buffer: Buffer): Promise<{
  result: ParsedSyllabusResponse;
  warnings: PipelineWarning[];
}> {
  const extractedText = await extractPdfText(buffer);
  const ollamaResult = await generateWithOllama({
    model: env.ollamaExtractionModel,
    prompt: buildExtractionPrompt(extractedText.text),
    format: extractionJsonSchema,
    temperature: 0.1,
    timeoutMs: 90_000,
  });
  const deadlineResult = await generateWithOllama({
    model: env.ollamaExtractionModel,
    prompt: buildDeadlineRescuePrompt(extractedText.text),
    format: deadlineJsonSchema,
    temperature: 0.05,
    timeoutMs: 90_000,
  });

  const parsedData = parseOllamaJson<ParsedSyllabusResponse>(ollamaResult.text);
  const deadlineData = parseOllamaJson<ParsedSyllabusResponse>(deadlineResult.text);
  parsedData.homework = mergeUniqueItems(parsedData.homework, deadlineData.homework, 'homework');
  parsedData.exams = mergeUniqueItems(parsedData.exams, deadlineData.exams, 'exam');
  parsedData.projects = mergeUniqueItems(parsedData.projects, deadlineData.projects, 'project');

  const normalized = normalizeSyllabusResponse(parsedData);

  return {
    result: normalized.syllabus,
    warnings: [
      ...extractedText.warnings.map((message) => ({ message })),
      ...normalized.warnings,
    ],
  };
}
