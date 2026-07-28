const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'proxy-authorization']);

/**
 * Redacts sensitive headers (Authorization, Cookie, etc.) from a headers object.
 *
 * @param headers - The original headers object.
 * @param enabled - Whether sanitization is enabled (default: true).
 * @returns A new headers object with sensitive values replaced by '***'.
 */
export function sanitizeHeaders(
  headers: Record<string, string>,
  enabled: boolean = true,
): Record<string, string> {
  if (!enabled) return headers;

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    sanitized[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '***' : value;
  }
  return sanitized;
}
