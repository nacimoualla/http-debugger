import { describe, it, expect } from 'vitest';
import { generateId, captureRequestBody, captureResponseBody } from '../../src/core/capture.js';

describe('generateId', () => {
  it('generates a unique string ID', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(typeof id1).toBe('string');
    expect(id1).not.toBe(id2);
  });
});

describe('captureRequestBody', () => {
  it('parses JSON body from buffer chunks', async () => {
    const chunks = [Buffer.from('{"name":"test"}')];
    const result = await captureRequestBody(chunks, 'application/json');
    expect(result).toEqual({ name: 'test' });
  });

  it('handles chunked JSON (multiple chunks)', async () => {
    const chunks = [
      Buffer.from('{"name":'),
      Buffer.from('"test"}'),
    ];
    const result = await captureRequestBody(chunks, 'application/json');
    expect(result).toEqual({ name: 'test' });
  });

  it('returns null for empty chunks', async () => {
    const result = await captureRequestBody([], 'application/json');
    expect(result).toBeNull();
  });

  it('truncates large body based on maxBodySize', async () => {
    const largeBody = 'x'.repeat(2048);
    const chunks = [Buffer.from(largeBody)];
    const result = await captureRequestBody(chunks, 'text/plain', 1024);
    expect(typeof result).toBe('string');
    expect(result).toContain('[truncated');
  });

  it('returns raw string for non-JSON content type', async () => {
    const chunks = [Buffer.from('plain text body')];
    const result = await captureRequestBody(chunks, 'text/plain');
    expect(result).toBe('plain text body');
  });

  it('handles malformed JSON gracefully', async () => {
    const chunks = [Buffer.from('{invalid json')];
    const result = await captureRequestBody(chunks, 'application/json');
    expect(result).toContain('[parse error');
  });
});

describe('captureResponseBody', () => {
  it('captures JSON body from chunks', () => {
    const chunks = [Buffer.from('{"id":1}')];
    const result = captureResponseBody(chunks, 1024);
    expect(result).toEqual({ id: 1 });
  });

  it('handles chunked response', () => {
    const chunks = [
      Buffer.from('{"id":'),
      Buffer.from('1}'),
    ];
    const result = captureResponseBody(chunks, 1024);
    expect(result).toEqual({ id: 1 });
  });

  it('truncates large response body', () => {
    const chunks = [Buffer.from('x'.repeat(2048))];
    const result = captureResponseBody(chunks, 1024);
    expect(result).toContain('[truncated');
  });

  it('returns null for empty chunks', () => {
    const result = captureResponseBody([], 1024);
    expect(result).toBeNull();
  });

  it('returns raw string for non-JSON', () => {
    const chunks = [Buffer.from('Hello World')];
    const result = captureResponseBody(chunks, 1024);
    expect(result).toBe('Hello World');
  });

  it('returns binary indicator for non-UTF8 data', () => {
    const chunks = [Buffer.from([0x00, 0x01, 0x02, 0x03])];
    const result = captureResponseBody(chunks, 1024);
    expect(typeof result).toBe('string');
  });
});
