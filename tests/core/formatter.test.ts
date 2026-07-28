import { describe, it, expect } from 'vitest';
import { formatEntry } from '../../src/core/formatter.js';
import type { DebugEntry } from '../../src/types.js';

function createMockEntry(overrides?: Partial<DebugEntry>): DebugEntry {
  return {
    id: 'test-id',
    timestamp: Date.now(),
    request: {
      method: 'GET',
      path: '/api/users',
      headers: { 'content-type': 'application/json' },
      body: null,
      bodyTruncated: false,
      query: {},
      params: {},
    },
    response: {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { id: 1 },
      bodyTruncated: false,
      size: 13,
    },
    timing: {
      headersReceived: 1,
      bodyComplete: 2,
      handlerStart: 3,
      handlerEnd: 40,
      responseStart: 41,
      responseEnd: 45,
    },
    duration: 45,
    ...overrides,
  };
}

describe('formatEntry', () => {
  it('formats request line with method and path', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('GET /api/users');
  });

  it('formats response line with status code and duration', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('200 OK (45ms)');
  });

  it('formats request headers', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('content-type: application/json');
  });

  it('formats request body', () => {
    const entry = createMockEntry({
      request: {
        ...createMockEntry().request,
        body: { name: 'Alice' },
      },
    });
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('"name": "Alice"');
  });

  it('formats response body', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('"id": 1');
  });

  it('formats timing breakdown', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('Timing:');
    expect(output).toContain('Headers:');
    expect(output).toContain('Handler:');
    expect(output).toContain('Response:');
  });

  it('sanitizes sensitive headers by default', () => {
    const entry = createMockEntry({
      request: {
        ...createMockEntry().request,
        headers: { authorization: 'Bearer abc123', 'content-type': 'application/json' },
      },
    });
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('authorization: ***');
  });

  it('skips sanitization when sanitize is false', () => {
    const entry = createMockEntry({
      request: {
        ...createMockEntry().request,
        headers: { authorization: 'Bearer abc123' },
      },
    });
    const output = formatEntry(entry, { colors: false, sanitize: false });
    expect(output).toContain('authorization: Bearer abc123');
  });

  it('handles null body', () => {
    const entry = createMockEntry({
      request: { ...createMockEntry().request, body: null },
      response: { ...createMockEntry().response, body: null },
    });
    const output = formatEntry(entry, { colors: false });
    expect(output).not.toContain('Body:');
  });

  it('collapses deeply nested objects with maxDepth', () => {
    const entry = createMockEntry({
      request: {
        ...createMockEntry().request,
        body: { a: { b: { c: { d: { e: 'deep' } } } } },
      },
    });
    const output = formatEntry(entry, { colors: false, maxDepth: 3 });
    expect(output).toContain('[Object]');
  });

  it('truncates large arrays with maxArrayItems', () => {
    const entry = createMockEntry({
      request: {
        ...createMockEntry().request,
        body: { items: Array.from({ length: 20 }, (_, i) => ({ id: i })) },
      },
    });
    const output = formatEntry(entry, { colors: false, maxArrayItems: 5 });
    expect(output).toContain('... 15 more');
  });

  it('shows cURL line when curl is true', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false, curl: true });
    expect(output).toContain('curl:');
    expect(output).toContain('curl -X GET');
  });

  it('hides cURL line when curl is false', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false, curl: false });
    expect(output).not.toContain('curl:');
  });

  it('shows cURL based on dynamic function', () => {
    const entry = createMockEntry({
      response: { ...createMockEntry().response, statusCode: 500 },
    });
    const output = formatEntry(entry, {
      colors: false,
      curl: (e) => e.response.statusCode >= 400,
    });
    expect(output).toContain('curl:');
  });

  it('omits -d flag when body was truncated', () => {
    const entry = createMockEntry({
      request: {
        ...createMockEntry().request,
        body: null,
        bodyTruncated: true,
      },
    });
    const output = formatEntry(entry, { colors: false, curl: true });
    expect(output).toContain('# Warning: Request body was truncated');
    expect(output).not.toContain("-d '");
  });
});
