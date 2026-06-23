import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/server/http/api-error';
import { generateAudioFromText } from '@/server/modules/audio/audio.service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { audioBuffer, contentType } = await generateAudioFromText(body?.text);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return toErrorResponse(error, 'Failed to generate audio. Please try again.');
  }
}
