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
  it('parses JSON body from buffer chunks', () => {
    const chunks = [Buffer.from('{"name":"test"}')];
    const result = captureRequestBody(chunks, 'application/json');
    expect(result.body).toEqual({ name: 'test' });
    expect(result.truncated).toBe(false);
  });

  it('handles chunked JSON (multiple chunks)', () => {
    const chunks = [
      Buffer.from('{"name":'),
      Buffer.from('"test"}'),
    ];
    const result = captureRequestBody(chunks, 'application/json');
    expect(result.body).toEqual({ name: 'test' });
    expect(result.truncated).toBe(false);
  });

  it('returns null body for empty chunks', () => {
    const result = captureRequestBody([], 'application/json');
    expect(result.body).toBeNull();
    expect(result.truncated).toBe(false);
  });

  it('sets truncated when body exceeds maxBodySize', () => {
    const largeBody = 'x'.repeat(2048);
    const chunks = [Buffer.from(largeBody)];
    const result = captureRequestBody(chunks, 'text/plain', 1024);
    expect(result.body).toBeNull();
    expect(result.truncated).toBe(true);
  });

  it('returns raw string for non-JSON content type', () => {
    const chunks = [Buffer.from('plain text body')];
    const result = captureRequestBody(chunks, 'text/plain');
    expect(result.body).toBe('plain text body');
    expect(result.truncated).toBe(false);
  });

  it('handles malformed JSON gracefully', () => {
    const chunks = [Buffer.from('{invalid json')];
    const result = captureRequestBody(chunks, 'application/json');
    expect(result.body).toContain('[parse error');
    expect(result.truncated).toBe(false);
  });
});

describe('captureResponseBody', () => {
  it('captures JSON body from chunks', () => {
    const chunks = [Buffer.from('{"id":1}')];
    const result = captureResponseBody(chunks, 1024);
    expect(result.body).toEqual({ id: 1 });
    expect(result.truncated).toBe(false);
  });

  it('handles chunked response', () => {
    const chunks = [
      Buffer.from('{"id":'),
      Buffer.from('1}'),
    ];
    const result = captureResponseBody(chunks, 1024);
    expect(result.body).toEqual({ id: 1 });
    expect(result.truncated).toBe(false);
  });

  it('sets truncated when response exceeds maxBodySize', () => {
    const chunks = [Buffer.from('x'.repeat(2048))];
    const result = captureResponseBody(chunks, 1024);
    expect(result.body).toBeNull();
    expect(result.truncated).toBe(true);
  });

  it('returns null body for empty chunks', () => {
    const result = captureResponseBody([], 1024);
    expect(result.body).toBeNull();
    expect(result.truncated).toBe(false);
  });

  it('returns raw string for non-JSON', () => {
    const chunks = [Buffer.from('Hello World')];
    const result = captureResponseBody(chunks, 1024);
    expect(result.body).toBe('Hello World');
    expect(result.truncated).toBe(false);
  });

  it('returns binary indicator for non-UTF8 data', () => {
    const chunks = [Buffer.from([0x00, 0x01, 0x02, 0x03])];
    const result = captureResponseBody(chunks, 1024);
    expect(typeof result.body).toBe('string');
    expect(result.truncated).toBe(false);
  });
});
