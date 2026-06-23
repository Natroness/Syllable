import { badRequest } from '@/server/http/api-error';
import { generateGroqSpeech } from './groq-tts.provider';

const MIN_AUDIO_TEXT_LENGTH = 20;
const MAX_AUDIO_TEXT_LENGTH = 5_000;

export async function generateAudioFromText(text: unknown): Promise<{
  audioBuffer: ArrayBuffer;
  contentType: string;
}> {
  if (typeof text !== 'string') {
    throw badRequest('No text provided for audio generation', { field: 'text', code: 'missing_text' });
  }

  const trimmedText = text.trim();
  if (trimmedText.length < MIN_AUDIO_TEXT_LENGTH) {
    throw badRequest('Text must be at least 20 characters for audio generation', {
      field: 'text',
      code: 'text_too_short',
    });
  }

  if (trimmedText.length > MAX_AUDIO_TEXT_LENGTH) {
    throw badRequest('Text must be 5,000 characters or less for audio generation', {
      field: 'text',
      code: 'text_too_long',
    });
  }

  if (!/[A-Za-z0-9]/.test(trimmedText)) {
    throw badRequest('Text must contain readable words for audio generation', {
      field: 'text',
      code: 'invalid_text',
    });
  }

  return generateGroqSpeech(trimmedText);
}
