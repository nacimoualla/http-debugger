import type { DebugEntry } from '../types.js';

export interface RawFilters {
  method?: string[];
  status?: string[];
  duration?: string;
  size?: string;
  dateRange?: { start?: number; end?: number };
}

export type CompiledPredicate = (entry: DebugEntry) => boolean;

const STATUS_RANGES: Record<string, [number, number]> = {
  '1xx': [100, 199],
  '2xx': [200, 299],
  '3xx': [300, 399],
  '4xx': [400, 499],
  '5xx': [500, 599],
};

function parseDuration(value: string): { op: string; ms: number } | null {
  const m = value.trim().match(/^([<>=!]=?)\s*(\d+(?:\.\d+)?)\s*(ms|s)$/i);
  if (!m) return null;
  const [, op, num, unit] = m;
  const ms = unit === 's' ? Number(num) * 1000 : Number(num);
  return { op, ms };
}

function parseSize(value: string): { op: string; bytes: number } | null {
  const m = value.trim().match(/^([<>=!]=?)\s*(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
  if (!m) return null;
  const [, op, num, unit] = m;
  const unitKey = (unit || 'b').toLowerCase();
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  const mult = multipliers[unitKey];
  if (mult === undefined) return null;
  return { op, bytes: Number(num) * mult };
}

function makeCompare(
  op: string,
  value: number,
  getValue: (e: DebugEntry) => number,
): (e: DebugEntry) => boolean {
  switch (op) {
    case '>':
      return (e) => getValue(e) > value;
    case '>=':
      return (e) => getValue(e) >= value;
    case '<':
      return (e) => getValue(e) < value;
    case '<=':
      return (e) => getValue(e) <= value;
    case '=':
      return (e) => getValue(e) === value;
    default:
      return () => true;
  }
}

export function parseFilters(raw: RawFilters): CompiledPredicate[] {
  const predicates: CompiledPredicate[] = [];

  if (raw.method?.length) {
    const set = new Set(raw.method.map((m) => m.toUpperCase()));
    predicates.push((e) => set.has(e.request.method.toUpperCase()));
  }

  if (raw.status?.length) {
    const ranges: [number, number][] = [];
    const exact: number[] = [];
    for (const s of raw.status) {
      if (STATUS_RANGES[s]) ranges.push(STATUS_RANGES[s]);
      else if (/^\d{3}$/.test(s)) exact.push(parseInt(s));
    }
    predicates.push((e) => {
      const sc = e.response.statusCode;
      return ranges.some(([min, max]) => sc >= min && sc <= max) || exact.includes(sc);
    });
  }

  if (raw.duration) {
    const parsed = parseDuration(raw.duration);
    if (parsed) {
      predicates.push(makeCompare(parsed.op, parsed.ms, (e) => e.duration));
    } else {
      predicates.push(() => true);
    }
  }

  if (raw.size) {
    const parsed = parseSize(raw.size);
    if (parsed) {
      predicates.push(makeCompare(parsed.op, parsed.bytes, (e) => e.response.size));
    } else {
      predicates.push(() => true);
    }
  }

  if (raw.dateRange) {
    const { start, end } = raw.dateRange;
    predicates.push((e) => {
      if (start !== undefined && e.timestamp < start) return false;
      if (end !== undefined && e.timestamp > end) return false;
      return true;
    });
  }

  return predicates;
}

export function applyFilters(entry: DebugEntry, predicates: CompiledPredicate[]): boolean {
  return predicates.every((p) => p(entry));
}
