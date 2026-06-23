import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFParse } from 'pdf-parse';

let workerConfigured = false;

export function configurePdfWorker(): void {
  if (workerConfigured) return;

  const workerPath = join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  if (existsSync(workerPath)) {
    PDFParse.setWorker(pathToFileURL(workerPath).toString());
  }

  workerConfigured = true;
}
