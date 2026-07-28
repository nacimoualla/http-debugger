import { randomUUID } from 'node:crypto';

/** Result of capturing a request or response body. */
export interface CaptureResult {
  /** The parsed body, or null if empty/truncated. */
  body: unknown;
  /** Whether the body exceeded maxBodySize and was truncated. */
  truncated: boolean;
}

/** Generates a unique UUID for each request. */
export function generateId(): string {
  return randomUUID();
}

/**
 * Captures and parses a request body from raw stream chunks.
 *
 * @param chunks - Raw body chunks collected from the request stream.
 * @param contentType - The Content-Type header value for JSON detection.
 * @param maxBodySize - Max bytes to capture before truncating (default: 1024).
 * @returns The parsed body and whether it was truncated.
 */
export function captureRequestBody(
  chunks: Buffer[],
  contentType: string,
  maxBodySize: number = 1024,
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

/**
 * Captures and parses a response body from raw stream chunks.
 *
 * @param chunks - Raw body chunks collected from the response stream.
 * @param maxBodySize - Max bytes to capture before truncating (default: 1024).
 * @returns The parsed body and whether it was truncated.
 */
export function captureResponseBody(chunks: Buffer[], maxBodySize: number = 1024): CaptureResult {
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
