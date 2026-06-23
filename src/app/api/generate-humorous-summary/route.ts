import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/server/http/api-error';
import { validatePdfUpload } from '@/server/modules/files/pdf-upload';
import { generateHumorousSummaryFromPdf } from '@/server/modules/summaries/summary.service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const { buffer } = await validatePdfUpload(formData.get('file'));
    const { result, warnings } = await generateHumorousSummaryFromPdf(buffer);

    return NextResponse.json({
      result,
      warnings,
      success: true,
    });
  } catch (error) {
    return toErrorResponse(error, 'Failed to generate humorous summary. Please try again.');
  }
}
