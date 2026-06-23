import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, 'bad_request', message, details);
}

export function serviceUnavailable(message: string, details?: unknown): ApiError {
  return new ApiError(503, 'service_unavailable', message, details);
}

export function toErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        success: false,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  console.error(fallbackMessage, error);
  return NextResponse.json(
    {
      error: fallbackMessage,
      success: false,
    },
    { status: 500 }
  );
}
