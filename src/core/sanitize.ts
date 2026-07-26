const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
]);

export function sanitizeHeaders(
  headers: Record<string, string>,
  enabled: boolean = true
): Record<string, string> {
  if (!enabled) return headers;

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    sanitized[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '***' : value;
  }
  return sanitized;
}
