import { PDFParse } from 'pdf-parse';
import { badRequest } from '@/server/http/api-error';

const MIN_USEFUL_TEXT_LENGTH = 500;
const MAX_TEXT_CHARS = 60_000;

export type ExtractedPdfText = {
  text: string;
  pageCount?: number;
  characterCount: number;
  warnings: string[];
};

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdfText> {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const normalizedText = normalizeText(result.text || '');

    if (!normalizedText) {
      throw badRequest('No readable text was found in this PDF. Scanned PDFs need OCR support.', {
        code: 'empty_pdf_text',
      });
    }

    const warnings: string[] = [];
    if (normalizedText.length < MIN_USEFUL_TEXT_LENGTH) {
      warnings.push('The PDF text extraction was very short. This may be a scanned PDF or a syllabus with image-based content.');
    }

    const truncatedText = normalizedText.slice(0, MAX_TEXT_CHARS);
    if (normalizedText.length > MAX_TEXT_CHARS) {
      warnings.push('The extracted PDF text was truncated before AI processing.');
    }

    return {
      text: truncatedText,
      pageCount: result.total,
      characterCount: normalizedText.length,
      warnings,
    };
  } finally {
    await parser.destroy();
  }
}
