import { describe, it, expect } from 'vitest';
import { sanitizeHeaders } from '../../src/core/sanitize.js';

describe('sanitizeHeaders', () => {
  it('redacts Authorization header', () => {
    const headers = { authorization: 'Bearer abc123', 'content-type': 'application/json' };
    const result = sanitizeHeaders(headers);
    expect(result.authorization).toBe('***');
    expect(result['content-type']).toBe('application/json');
  });

  it('redacts Cookie header', () => {
    const headers = { cookie: 'session=xyz', host: 'example.com' };
    const result = sanitizeHeaders(headers);
    expect(result.cookie).toBe('***');
  });

  it('redacts Set-Cookie header', () => {
    const headers = { 'set-cookie': 'session=abc; Path=/' };
    const result = sanitizeHeaders(headers);
    expect(result['set-cookie']).toBe('***');
  });

  it('redacts Proxy-Authorization header', () => {
    const headers = { 'proxy-authorization': 'Basic admin:pass' };
    const result = sanitizeHeaders(headers);
    expect(result['proxy-authorization']).toBe('***');
  });

  it('preserves non-sensitive headers', () => {
    const headers = {
      'content-type': 'application/json',
      'x-request-id': '123',
      accept: '*/*',
    };
    const result = sanitizeHeaders(headers);
    expect(result).toEqual(headers);
  });

  it('returns same object when sanitize is false', () => {
    const headers = { authorization: 'Bearer abc123' };
    const result = sanitizeHeaders(headers, false);
    expect(result).toBe(headers);
  });

  it('handles empty headers object', () => {
    const result = sanitizeHeaders({});
    expect(result).toEqual({});
  });
});
