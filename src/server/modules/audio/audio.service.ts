import { env } from '@/server/config/env';
import { badRequest } from '@/server/http/api-error';
import { generateGroqSpeech } from './groq-tts.provider';

const MIN_AUDIO_TEXT_LENGTH = 20;
const MAX_AUDIO_TEXT_LENGTH = 5_000;

function shortenForTts(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const selectedSentences: string[] = [];
  let totalLength = 0;

  for (const sentence of sentences) {
    const normalizedSentence = sentence.trim();
    if (!normalizedSentence) continue;

    const nextLength = totalLength + normalizedSentence.length + (selectedSentences.length > 0 ? 1 : 0);
    if (nextLength > maxChars) break;

    selectedSentences.push(normalizedSentence);
    totalLength = nextLength;
  }

  const shortenedText = selectedSentences.join(' ').trim();
  if (shortenedText.length >= MIN_AUDIO_TEXT_LENGTH) {
    return shortenedText;
  }

  return `${text.slice(0, Math.max(MIN_AUDIO_TEXT_LENGTH, maxChars - 1)).trimEnd()}.`;
}

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

  return generateGroqSpeech(shortenForTts(trimmedText, env.groqTtsMaxInputChars));
}
