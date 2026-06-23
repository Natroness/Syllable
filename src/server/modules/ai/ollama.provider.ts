import { env } from '@/server/config/env';
import { serviceUnavailable } from '@/server/http/api-error';

type OllamaGenerateInput = {
  model: string;
  prompt: string;
  system?: string;
  format?: 'json' | Record<string, unknown>;
  temperature?: number;
  timeoutMs?: number;
};

type OllamaGenerateResponse = {
  model: string;
  response?: string;
  done?: boolean;
};

export type OllamaGenerateOutput = {
  text: string;
  model: string;
  durationMs: number;
};

export async function generateWithOllama(input: OllamaGenerateInput): Promise<OllamaGenerateOutput> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs || 60_000);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${env.ollamaBaseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        system: input.system,
        format: input.format,
        stream: false,
        options: {
          temperature: input.temperature ?? 0.2,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw serviceUnavailable('Ollama generation failed', {
        status: response.status,
        providerMessage: errorText.slice(0, 500),
      });
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    if (!data.response) {
      throw serviceUnavailable('Ollama returned an empty response', { model: input.model });
    }

    return {
      text: data.response,
      model: data.model || input.model,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw serviceUnavailable('Ollama request timed out', { model: input.model });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
