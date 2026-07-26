import { randomUUID } from 'node:crypto';

export function generateId(): string {
  return randomUUID();
}

export function captureRequestBody(
  chunks: Buffer[],
  contentType: string,
  maxBodySize: number = 1024
): unknown {
  if (chunks.length === 0) return null;

  const buffer = Buffer.concat(chunks);

  if (buffer.length > maxBodySize) {
    return `[truncated, ${(buffer.length / 1024).toFixed(1)}KB total]`;
  }

  const str = buffer.toString('utf-8');
  const isJson = contentType?.includes('application/json');

  if (isJson) {
    try {
      return JSON.parse(str);
    } catch {
      return `[parse error: invalid JSON]`;
    }
  }

  return str;
}

export function captureResponseBody(
  chunks: Buffer[],
  maxBodySize: number = 1024
): unknown {
  if (chunks.length === 0) return null;

  const buffer = Buffer.concat(chunks);

  if (buffer.length > maxBodySize) {
    return `[truncated, ${(buffer.length / 1024).toFixed(1)}KB total]`;
  }

  const str = buffer.toString('utf-8');

  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
