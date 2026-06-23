import { env } from '@/server/config/env';
import { badRequest } from '@/server/http/api-error';

export type ValidatedPdfUpload = {
  file: File;
  buffer: Buffer;
};

export async function validatePdfUpload(file: FormDataEntryValue | null): Promise<ValidatedPdfUpload> {
  if (!(file instanceof File)) {
    throw badRequest('No file provided', { field: 'file', code: 'missing_file' });
  }

  if (file.type !== 'application/pdf') {
    throw badRequest('File must be a PDF', { field: 'file', code: 'invalid_file_type' });
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw badRequest('File must use a .pdf extension', { field: 'file', code: 'invalid_file_extension' });
  }

  if (file.size > env.maxUploadBytes) {
    throw badRequest('File size must be less than 10MB', { field: 'file', code: 'file_too_large' });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const header = buffer.subarray(0, 5).toString('utf8');
  if (header !== '%PDF-') {
    throw badRequest('File content is not a valid PDF', { field: 'file', code: 'invalid_pdf_signature' });
  }

  return { file, buffer };
}
