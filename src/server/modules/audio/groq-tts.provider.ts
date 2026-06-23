import { env } from '@/server/config/env';
import { serviceUnavailable } from '@/server/http/api-error';

export type GroqSpeechOutput = {
  audioBuffer: ArrayBuffer;
  contentType: string;
};

function contentTypeForFormat(format: string): string {
  switch (format) {
    case 'mp3':
      return 'audio/mpeg';
    case 'flac':
      return 'audio/flac';
    case 'opus':
      return 'audio/opus';
    case 'wav':
    default:
      return 'audio/wav';
  }
}

export async function generateGroqSpeech(text: string): Promise<GroqSpeechOutput> {
  if (!env.groqApiKey) {
    throw serviceUnavailable('Groq API key not configured. Audio generation unavailable.', {
      code: 'missing_groq_api_key',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.groqTtsModel,
        voice: env.groqTtsVoice,
        input: text,
        response_format: env.groqTtsResponseFormat,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw serviceUnavailable('Audio generation failed', {
        status: response.status,
        providerMessage: errorText.slice(0, 500),
      });
    }

    return {
      audioBuffer: await response.arrayBuffer(),
      contentType: response.headers.get('content-type') || contentTypeForFormat(env.groqTtsResponseFormat),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw serviceUnavailable('Groq TTS request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
