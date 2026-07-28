import { describe, it, expect } from 'vitest';
import { readBodyWithLimit } from '../../src/core/stream.js';

describe('readBodyWithLimit', () => {
  it('returns empty string for null stream', async () => {
    const result = await readBodyWithLimit(null, 1024);
    expect(result.body).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('reads body within limit', async () => {
    const data = new TextEncoder().encode('hello world');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 1024);
    expect(result.body).toBe('hello world');
    expect(result.truncated).toBe(false);
  });

  it('truncates body exceeding limit', async () => {
    const data = new TextEncoder().encode('x'.repeat(2048));
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 1024);
    expect(result.body.length).toBeLessThanOrEqual(1024);
    expect(result.truncated).toBe(true);
  });

  it('handles multiple chunks', async () => {
    const chunk1 = new TextEncoder().encode('hello ');
    const chunk2 = new TextEncoder().encode('world');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 1024);
    expect(result.body).toBe('hello world');
    expect(result.truncated).toBe(false);
  });

  it('truncates at exact limit boundary', async () => {
    // 1024 bytes exactly
    const data = new TextEncoder().encode('a'.repeat(1024));
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 1024);
    expect(result.body.length).toBe(1024);
    expect(result.truncated).toBe(false);
  });

  it('truncates when first chunk exceeds limit', async () => {
    const data = new TextEncoder().encode('hello world');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 5);
    expect(result.body).toBe('hello');
    expect(result.truncated).toBe(true);
  });

  it('returns empty body for empty stream', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 1024);
    expect(result.body).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('handles binary data correctly (UTF-8 multi-byte)', async () => {
    const data = new TextEncoder().encode('café'); // 5 bytes (c=1, a=1, f=1, é=2)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 1024);
    expect(result.body).toBe('café');
    expect(result.truncated).toBe(false);
  });

  it('truncates multi-byte character correctly', async () => {
    // 'é' is 2 bytes. If limit is 4, we get 'caf' + first byte of 'é'?
    // Actually subarray splits at byte boundary. Let's test with limit 4.
    const data = new TextEncoder().encode('café'); // bytes: 63 61 66 c3 a9
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 4);
    // Should get first 4 bytes: 63 61 66 c3 -> 'caf' + partial UTF-8
    // TextDecoder will replace invalid sequence with replacement char
    expect(result.truncated).toBe(true);
    expect(result.body.length).toBeGreaterThanOrEqual(3);
    expect(result.body.length).toBeLessThanOrEqual(4);
  });

  it('handles large number of small chunks', async () => {
    const chunks = Array.from({ length: 100 }, (_, i) =>
      new TextEncoder().encode(String(i % 10)),
    );
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 50);
    expect(result.body.length).toBeLessThanOrEqual(50);
    expect(result.truncated).toBe(true);
  });

  it('returns truncated true when total exceeds limit across chunks', async () => {
    const chunk1 = new TextEncoder().encode('a'.repeat(600));
    const chunk2 = new TextEncoder().encode('b'.repeat(600));
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 1024);
    expect(result.body.length).toBe(1024);
    expect(result.truncated).toBe(true);
  });
});
