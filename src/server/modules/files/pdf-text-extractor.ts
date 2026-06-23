import { PDFParse } from 'pdf-parse';
import { env } from '@/server/config/env';
import { ApiError, badRequest } from '@/server/http/api-error';
import { extractPdfTextWithOcr } from './pdf-ocr-extractor';
import { configurePdfWorker } from './pdf-worker';

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
  configurePdfWorker();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    const normalizedText = normalizeText(result.text || '');

    if (!normalizedText) {
      if (env.pdfOcrFallback) {
        const ocrResult = await extractPdfTextWithOcr(buffer);
        return {
          text: normalizeText(ocrResult.text).slice(0, MAX_TEXT_CHARS),
          pageCount: ocrResult.pageCount,
          characterCount: ocrResult.text.length,
          warnings: ocrResult.warnings,
        };
      }

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
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (env.pdfOcrFallback) {
      try {
        const ocrResult = await extractPdfTextWithOcr(buffer);
        return {
          text: normalizeText(ocrResult.text).slice(0, MAX_TEXT_CHARS),
          pageCount: ocrResult.pageCount,
          characterCount: ocrResult.text.length,
          warnings: [
            ...ocrResult.warnings,
            'Normal PDF text extraction failed, so OCR fallback was used.',
          ],
        };
      } catch (ocrError) {
        throw badRequest('Could not extract readable text from this PDF, and OCR fallback also failed.', {
          code: 'pdf_text_and_ocr_failed',
          parserMessage: error instanceof Error ? error.message : String(error),
          ocrMessage: ocrError instanceof Error ? ocrError.message : String(ocrError),
        });
      }
    }

    throw badRequest('Could not extract readable text from this PDF. If it is scanned or image-based, OCR support is required.', {
      code: 'pdf_text_extraction_failed',
      parserMessage: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await parser.destroy();
  }
}
