/**
 * Reads a ReadableStream with a byte limit, returning the body as a string.
 * If the stream exceeds maxBodySize, returns truncated: true and partial body.
 */
export async function readBodyWithLimit(
  stream: ReadableStream | null,
  maxBodySize: number,
): Promise<{ body: string; truncated: boolean }> {
  if (!stream) return { body: '', truncated: false };

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.length;
    if (totalBytes <= maxBodySize) {
      chunks.push(value);
    } else {
      const remaining = maxBodySize - chunks.reduce((acc, c) => acc + c.length, 0);
      if (remaining > 0) {
        chunks.push(value.subarray(0, remaining));
      }
      truncated = true;
      reader.cancel();
      break;
    }
  }

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  const decoder = new TextDecoder();
  return { body: decoder.decode(combined), truncated };
}
