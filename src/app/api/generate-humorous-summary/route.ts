import { NextRequest, NextResponse } from 'next/server';
import { badRequest, toErrorResponse } from '@/server/http/api-error';
import { validatePdfUpload } from '@/server/modules/files/pdf-upload';
import {
  generateHumorousSummaryFromPdf,
  generateHumorousSummaryFromSyllabus,
} from '@/server/modules/summaries/summary.service';
import type { ParsedSyllabusResponse } from '@/server/modules/syllabi/syllabus-types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const syllabusJson = formData.get('syllabus');
    const { result, warnings } = typeof syllabusJson === 'string' && syllabusJson.trim()
      ? await generateHumorousSummaryFromSyllabus(parseSyllabusJson(syllabusJson))
      : await generateSummaryFromUploadedPdf(formData);

    return NextResponse.json({
      result,
      warnings,
      success: true,
    });
  } catch (error) {
    return toErrorResponse(error, 'Failed to generate humorous summary. Please try again.');
  }
}

function parseSyllabusJson(value: string): ParsedSyllabusResponse {
  try {
    return JSON.parse(value) as ParsedSyllabusResponse;
  } catch {
    throw badRequest('Parsed syllabus payload was not valid JSON', {
      field: 'syllabus',
      code: 'invalid_syllabus_json',
    });
  }
}

async function generateSummaryFromUploadedPdf(formData: FormData): Promise<{
  result: string;
  warnings: { message: string; field?: string }[];
}> {
  const { buffer } = await validatePdfUpload(formData.get('file'));
  return generateHumorousSummaryFromPdf(buffer);
}
