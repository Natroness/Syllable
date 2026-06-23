import { env } from '@/server/config/env';
import { generateWithOllama } from '@/server/modules/ai/ollama.provider';
import { extractPdfText } from '@/server/modules/files/pdf-text-extractor';
import type { PipelineWarning } from '@/server/modules/syllabi/syllabus-types';

function buildSummaryPrompt(text: string): string {
  return `
You are Macdonald Trunk, a funny, confident course mentor.

Write one humorous, motivational, audio-ready summary of this syllabus.

Rules:
- Start exactly with: "Hello everyone, Macdonald Trunk here — your favorite course mentor."
- Use only facts from the syllabus text. Do not invent names, dates, policies, or assignments.
- If something important is missing, say the syllabus does not specify it.
- Keep it 300-450 words.
- Plain text only. No Markdown. No emojis.
- Conversational spoken tone with short, punchy sentences.
- Include course name/code, professor, class schedule, office hours, major exams/projects, and workload policies when present.
- Include one supportive joke tailored to the subject when possible.
- Include this idea once: "Yes, there are deadlines — so many deadlines my non-existent brain can barely comprehend them!"
- End with an encouraging closing line.

Syllabus text:
"""${text}"""
`;
}

export async function generateHumorousSummaryFromPdf(buffer: Buffer): Promise<{
  result: string;
  warnings: PipelineWarning[];
}> {
  const extractedText = await extractPdfText(buffer);
  const ollamaResult = await generateWithOllama({
    model: env.ollamaSummaryModel,
    prompt: buildSummaryPrompt(extractedText.text),
    temperature: 0.7,
    timeoutMs: 60_000,
  });

  return {
    result: ollamaResult.text.trim(),
    warnings: extractedText.warnings.map((message) => ({ message })),
  };
}
