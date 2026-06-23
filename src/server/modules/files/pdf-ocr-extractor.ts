import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { PDFParse } from 'pdf-parse';
import { env } from '@/server/config/env';
import { serviceUnavailable } from '@/server/http/api-error';
import { configurePdfWorker } from './pdf-worker';

const OCR_PAGE_TIMEOUT_MS = 30_000;
const COMMON_TESSERACT_PATHS = [
  '/opt/homebrew/bin/tesseract',
  '/usr/local/bin/tesseract',
  '/usr/bin/tesseract',
];

function resolveTesseractPath(): string {
  if (env.tesseractPath !== 'tesseract') {
    return env.tesseractPath;
  }

  return COMMON_TESSERACT_PATHS.find((path) => existsSync(path)) || env.tesseractPath;
}

function runTesseract(image: Uint8Array, pageNumber: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const tesseractPath = resolveTesseractPath();
    const child = spawn(tesseractPath, [
      'stdin',
      'stdout',
      '-l',
      'eng',
      '--psm',
      '6',
      '--dpi',
      '200',
      '--loglevel',
      'ERROR',
    ]);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Tesseract timed out on page ${pageNumber}`));
    }, OCR_PAGE_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start Tesseract at "${tesseractPath}": ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks).toString('utf8'));
        return;
      }

      reject(new Error(Buffer.concat(stderrChunks).toString('utf8') || `Tesseract exited with code ${code}`));
    });

    child.stdin.end(Buffer.from(image));
  });
}

export async function extractPdfTextWithOcr(buffer: Buffer): Promise<{
  text: string;
  pageCount?: number;
  pagesProcessed: number;
  warnings: string[];
}> {
  configurePdfWorker();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const screenshotResult = await parser.getScreenshot({
      first: env.ocrMaxPages,
      desiredWidth: 1600,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const pageTexts: string[] = [];
    for (const page of screenshotResult.pages) {
      pageTexts.push(await runTesseract(page.data, page.pageNumber));
    }

    const text = pageTexts.join('\n\n').trim();
    if (!text) {
      throw serviceUnavailable('OCR completed but did not find readable text in this PDF.', {
        code: 'empty_ocr_text',
      });
    }

    return {
      text,
      pageCount: screenshotResult.total,
      pagesProcessed: screenshotResult.pages.length,
      warnings: [
        `Used OCR fallback on ${screenshotResult.pages.length} page(s). Please review extracted dates and titles carefully.`,
      ],
    };
  } finally {
    await parser.destroy();
  }
}
