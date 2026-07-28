import { describe, it, expect } from 'vitest';
import { parseFilters, applyFilters } from '../../src/core/filters.js';
import type { DebugEntry } from '../../src/types.js';

function entry(overrides: Partial<DebugEntry> = {}): DebugEntry {
  return {
    id: '1',
    timestamp: Date.now(),
    request: { method: 'GET', path: '/api/users', headers: {}, body: null, bodyTruncated: false, query: {}, params: {} },
    response: { statusCode: 200, headers: {}, body: null, bodyTruncated: false, size: 100 },
    timing: { headersReceived: 1, bodyComplete: 2, handlerStart: 3, handlerEnd: 10, responseStart: 11, responseEnd: 15 },
    duration: 15,
    ...overrides,
  };
}

describe('parseFilters', () => {
  it('parses method filter', () => {
    const preds = parseFilters({ method: ['GET', 'POST'] });
    expect(preds.length).toBe(1);
    expect(preds[0](entry({ request: { ...entry().request, method: 'GET' } }))).toBe(true);
    expect(preds[0](entry({ request: { ...entry().request, method: 'DELETE' } }))).toBe(false);
  });

  it('parses status filter with ranges', () => {
    const preds = parseFilters({ status: ['2xx', '404'] });
    expect(preds[0](entry({ response: { ...entry().response, statusCode: 200 } }))).toBe(true);
    expect(preds[0](entry({ response: { ...entry().response, statusCode: 404 } }))).toBe(true);
    expect(preds[0](entry({ response: { ...entry().response, statusCode: 500 } }))).toBe(false);
  });

  it('parses duration operators', () => {
    const preds = parseFilters({ duration: '>500ms' });
    expect(preds[0](entry({ duration: 600 }))).toBe(true);
    expect(preds[0](entry({ duration: 400 }))).toBe(false);
  });

  it('parses size operators with units', () => {
    const preds = parseFilters({ size: '<10KB' });
    const e = entry({ response: { ...entry().response, size: 5000 } });
    expect(preds[0](e)).toBe(true);
    const e2 = entry({ response: { ...entry().response, size: 20000 } });
    expect(preds[0](e2)).toBe(false);
  });

  it('parses date range', () => {
    const now = Date.now();
    const preds = parseFilters({ dateRange: { start: now - 3600000, end: now } });
    expect(preds[0](entry({ timestamp: now - 1800000 }))).toBe(true);
    expect(preds[0](entry({ timestamp: now - 7200000 }))).toBe(false);
  });

  it('returns empty array for empty input', () => {
    expect(parseFilters({})).toEqual([]);
    expect(parseFilters({ method: [] })).toEqual([]);
  });

  it('invalid operator returns no-op predicate', () => {
    const preds = parseFilters({ duration: '~500ms' });
    expect(preds[0](entry({ duration: 100 }))).toBe(true); // ignore invalid
  });
});

describe('applyFilters', () => {
  it('returns true when no predicates', () => {
    expect(applyFilters(entry(), [])).toBe(true);
  });

  it('ANDs all predicates', () => {
    const e = entry({ request: { method: 'POST' }, duration: 600 });
    const preds = [ (e: DebugEntry) => e.request.method === 'POST', (e: DebugEntry) => e.duration > 500 ];
    expect(applyFilters(e, preds)).toBe(true);
  });

  it('returns false if any predicate fails', () => {
    const e = entry({ request: { method: 'GET' }, duration: 600 });
    const preds = [ (e: DebugEntry) => e.request.method === 'POST', (e: DebugEntry) => e.duration > 500 ];
    expect(applyFilters(e, preds)).toBe(false);
  });
});