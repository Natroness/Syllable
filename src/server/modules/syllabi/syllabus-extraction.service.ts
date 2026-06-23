import { env } from '@/server/config/env';
import { badRequest } from '@/server/http/api-error';
import { generateWithOllama } from '@/server/modules/ai/ollama.provider';
import { extractPdfText } from '@/server/modules/files/pdf-text-extractor';
import type { ParsedSyllabusResponse, PipelineWarning } from './syllabus-types';
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

function parseOllamaJson(text: string): ParsedSyllabusResponse {
  try {
    return JSON.parse(text) as ParsedSyllabusResponse;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw badRequest('Ollama did not return valid syllabus JSON', { code: 'invalid_ollama_json' });
    }
    return JSON.parse(jsonMatch[0]) as ParsedSyllabusResponse;
  }
}

function buildExtractionPrompt(text: string): string {
  return `
You are a careful syllabus parser. Extract course details, assignments, exams, projects, office hours, and class meeting times from the syllabus text.

Rules:
- Use only the provided syllabus text. Do not invent missing information.
- Return valid JSON only.
- Convert clear dates to YYYY-MM-DD.
- If a date is ambiguous or missing, omit that date field.
- Preserve full assignment, exam, and project titles.
- Include all relevant deadlines from schedules, tables, grading sections, and calendar sections.

Syllabus text:
"""${text}"""
`;
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

  const parsedData = parseOllamaJson(ollamaResult.text);
  const normalized = normalizeSyllabusResponse(parsedData);

  return {
    result: normalized.syllabus,
    warnings: [
      ...extractedText.warnings.map((message) => ({ message })),
      ...normalized.warnings,
    ],
  };
}
