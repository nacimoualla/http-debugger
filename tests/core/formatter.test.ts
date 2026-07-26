import { describe, it, expect } from 'vitest';
import { formatEntry } from '../../src/core/formatter.js';
import type { DebugEntry } from '../../src/types.js';

function createMockEntry(overrides?: Partial<DebugEntry>): DebugEntry {
  return {
    id: 'test-id',
    request: {
      method: 'GET',
      path: '/api/users',
      headers: { 'content-type': 'application/json' },
      body: null,
      query: {},
      params: {},
    },
    response: {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { id: 1 },
      size: 13,
    },
    timing: {
      start: 1000,
      headersReceived: 1001,
      bodyComplete: 1002,
      handlerStart: 1003,
      handlerEnd: 1040,
      responseStart: 1041,
      responseEnd: 1045,
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
});
