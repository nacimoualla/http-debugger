import type { DebugEntry, MiddlewareOptions } from '../types.js';
import { sanitizeHeaders } from './sanitize.js';

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
};

const ansi = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function colorize(text: string, color: string, enabled: boolean): string {
  return enabled ? `${color}${text}${ansi.reset}` : text;
}

function createDepthReplacer(maxDepth: number, maxArrayItems: number) {
  const seen = new WeakSet();

  return function replacer(this: unknown, key: string, value: unknown): unknown {
    if (key === '') return value;

    if (Array.isArray(value) && value.length > maxArrayItems) {
      const first = value.slice(0, maxArrayItems);
      const rest = value.length - maxArrayItems;
      const firstStr = first.map(i => JSON.stringify(i, replacer)).join(', ');
      return `[${firstStr}, ... ${rest} more]`;
    }

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);

      const depth = this && typeof this === 'object' ? getObjectDepth(this) : 0;
      if (depth >= maxDepth) {
        return '[Object]';
      }
    }

    return value;
  };
}

function getObjectDepth(obj: unknown): number {
  let depth = 0;
  let current = obj;
  while (current && typeof current === 'object') {
    depth++;
    const keys = Object.keys(current);
    if (keys.length === 0) break;
    current = (current as Record<string, unknown>)[keys[0]];
  }
  return depth;
}

function formatBody(body: unknown, maxDepth: number, maxArrayItems: number): string {
  if (body === null || body === undefined) return '';
  if (typeof body === 'string') return body;
  const replacer = createDepthReplacer(maxDepth, maxArrayItems);
  return JSON.stringify(body, replacer, 2);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatDuration(ms: number): string {
  return `${ms}ms`;
}

function formatTimingValue(value: number, start: number): string {
  if (value === 0) return '—';
  return `${value - start}ms`;
}

function generateCurl(entry: DebugEntry): string {
  const { request } = entry;
  const method = request.method.toUpperCase();
  const url = request.path.startsWith('http') ? request.path : `http://localhost${request.path}`;

  let curl = `curl -X ${method} '${url}'`;

  const sanitizedHeaders = sanitizeHeaders(request.headers, true);
  for (const [key, value] of Object.entries(sanitizedHeaders)) {
    curl += ` -H '${key}: ${value}'`;
  }

  if (request.bodyTruncated) {
    curl += ` \\\n    # Warning: Request body was truncated, command may be incomplete`;
  } else if (request.body !== null && request.body !== undefined) {
    const bodyStr = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    curl += ` -d '${bodyStr}'`;
  }

  return curl;
}

export function formatEntry(
  entry: DebugEntry,
  options: Pick<MiddlewareOptions, 'colors' | 'sanitize' | 'maxDepth' | 'maxArrayItems' | 'curl'> = {}
): string {
  const useColors = options.colors !== false;
  const useSanitize = options.sanitize !== false;
  const maxDepth = options.maxDepth ?? 4;
  const maxArrayItems = options.maxArrayItems ?? 10;
  const { request, response, timing, duration } = entry;

  const lines: string[] = [];

  const methodColor = request.method === 'GET' || request.method === 'HEAD'
    ? ansi.cyan
    : request.method === 'DELETE'
      ? ansi.yellow
      : ansi.green;

  lines.push(
    `${colorize('→', methodColor, useColors)} ${request.method} ${request.path}`
  );

  const reqHeaders = sanitizeHeaders(request.headers, useSanitize);
  if (Object.keys(reqHeaders).length > 0) {
    for (const [key, value] of Object.entries(reqHeaders)) {
      lines.push(`  ${colorize(`${key}: ${value}`, ansi.dim, useColors)}`);
    }
  }

  const reqBody = formatBody(request.body, maxDepth, maxArrayItems);
  if (reqBody) {
    lines.push(`  Body: ${reqBody}`);
  }

  lines.push('');

  const statusColor = response.statusCode < 300
    ? ansi.green
    : response.statusCode < 400
      ? ansi.yellow
      : ansi.red;

  const statusText = STATUS_TEXT[response.statusCode] || '';
  lines.push(
    `${colorize('←', statusColor, useColors)} ${response.statusCode} ${statusText} (${formatDuration(duration)})`
  );

  if (Object.keys(response.headers).length > 0) {
    for (const [key, value] of Object.entries(response.headers)) {
      lines.push(`  ${colorize(`${key}: ${value}`, ansi.dim, useColors)}`);
    }
  }

  const resBody = formatBody(response.body, maxDepth, maxArrayItems);
  if (resBody) {
    lines.push(`  Body: ${resBody}`);
  }

  lines.push(`  Size: ${formatSize(response.size)}`);

  lines.push('');

  lines.push('  Timing:');
  lines.push(`    Headers:   ${formatTimingValue(timing.headersReceived, 0)}`);
  lines.push(`    Body Read: ${formatTimingValue(timing.bodyComplete, timing.headersReceived)}`);
  lines.push(`    Handler:   ${formatTimingValue(timing.handlerEnd, timing.handlerStart)}`);
  lines.push(`    Response:  ${formatTimingValue(timing.responseEnd, timing.responseStart)}`);

  const shouldShowCurl = options.curl === true ||
    (typeof options.curl === 'function' && options.curl(entry));

  if (shouldShowCurl) {
    lines.push('');
    lines.push(`  curl: ${generateCurl(entry)}`);
  }

  return lines.join('\n');
}
