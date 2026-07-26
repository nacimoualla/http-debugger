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

function formatBody(body: unknown): string {
  if (body === null || body === undefined) return '';
  if (typeof body === 'string') return body;
  return JSON.stringify(body, null, 2);
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

export function formatEntry(
  entry: DebugEntry,
  options: Pick<MiddlewareOptions, 'colors' | 'sanitize'> = {}
): string {
  const useColors = options.colors !== false;
  const useSanitize = options.sanitize !== false;
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

  const reqBody = formatBody(request.body);
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

  const resBody = formatBody(response.body);
  if (resBody) {
    lines.push(`  Body: ${resBody}`);
  }

  lines.push(`  Size: ${formatSize(response.size)}`);

  lines.push('');

  lines.push('  Timing:');
  lines.push(`    Headers:   ${formatTimingValue(timing.headersReceived, timing.start)}`);
  lines.push(`    Body Read: ${formatTimingValue(timing.bodyComplete, timing.headersReceived)}`);
  lines.push(`    Handler:   ${formatTimingValue(timing.handlerEnd, timing.handlerStart)}`);
  lines.push(`    Response:  ${formatTimingValue(timing.responseEnd, timing.responseStart)}`);

  return lines.join('\n');
}
