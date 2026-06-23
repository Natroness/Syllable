import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/server/http/api-error';
import { validatePdfUpload } from '@/server/modules/files/pdf-upload';
import { extractSyllabusFromPdf } from '@/server/modules/syllabi/syllabus-extraction.service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const { buffer } = await validatePdfUpload(formData.get('file'));
    const { result, warnings } = await extractSyllabusFromPdf(buffer);

    return NextResponse.json({
      result,
      warnings,
      success: true,
    });
  } catch (error) {
    return toErrorResponse(error, 'Failed to process PDF. Please try again.');
  }
}
