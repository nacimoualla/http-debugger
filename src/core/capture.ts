import { randomUUID } from 'node:crypto';

export function generateId(): string {
  return randomUUID();
}

export interface CaptureResult {
  body: unknown;
  truncated: boolean;
}

export function captureRequestBody(
  chunks: Buffer[],
  contentType: string,
  maxBodySize: number = 1024
): CaptureResult {
  if (chunks.length === 0) return { body: null, truncated: false };

  const buffer = Buffer.concat(chunks);
  const truncated = buffer.length > maxBodySize;

  if (truncated) {
    return { body: null, truncated: true };
  }

  const str = buffer.toString('utf-8');
  const isJson = contentType?.includes('application/json');

  if (isJson) {
    try {
      return { body: JSON.parse(str), truncated: false };
    } catch {
      return { body: '[parse error: invalid JSON]', truncated: false };
    }
  }

  return { body: str, truncated: false };
}

export function captureResponseBody(
  chunks: Buffer[],
  maxBodySize: number = 1024
): CaptureResult {
  if (chunks.length === 0) return { body: null, truncated: false };

  const buffer = Buffer.concat(chunks);
  const truncated = buffer.length > maxBodySize;

  if (truncated) {
    return { body: null, truncated: true };
  }

  const str = buffer.toString('utf-8');

  try {
    return { body: JSON.parse(str), truncated: false };
  } catch {
    return { body: str, truncated: false };
  }
}
