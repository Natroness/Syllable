export type PipelineProvider = 'local' | 'ollama' | 'groq' | 'gemini' | 'elevenlabs';

const DEFAULT_MAX_UPLOAD_MB = 10;

function readNumber(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

export const env = {
  pdfTextProvider: process.env.PDF_TEXT_PROVIDER || 'local',
  summaryProvider: process.env.SUMMARY_PROVIDER || 'ollama',
  ttsProvider: process.env.TTS_PROVIDER || 'groq',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ollamaExtractionModel: process.env.OLLAMA_EXTRACTION_MODEL || 'llama3.1:8b',
  ollamaSummaryModel: process.env.OLLAMA_SUMMARY_MODEL || 'llama3.1:8b',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqTtsModel: process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english',
  groqTtsVoice: process.env.GROQ_TTS_VOICE || 'hannah',
  groqTtsResponseFormat: process.env.GROQ_TTS_RESPONSE_FORMAT || 'wav',
  maxUploadBytes: readNumber('MAX_UPLOAD_MB', DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024,
  pdfOcrFallback: process.env.PDF_OCR_FALLBACK !== 'false',
  tesseractPath: process.env.TESSERACT_PATH || 'tesseract',
  ocrMaxPages: readNumber('OCR_MAX_PAGES', 5),
};
