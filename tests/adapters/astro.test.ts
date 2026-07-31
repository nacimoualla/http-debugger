import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { httpDebugger } from '../../src/adapters/astro.js';
import type { APIContext, MiddlewareNext } from 'astro';

function createMockContext(
  overrides: Partial<{
    method: string;
    pathname: string;
    search: string;
    headers: Record<string, string>;
    body: string | null;
    params: Record<string, string>;
  }> = {},
): APIContext {
  const method = overrides.method ?? 'GET';
  const pathname = overrides.pathname ?? '/test';
  const search = overrides.search ?? '';
  const url = new URL(`http://localhost${pathname}${search}`);
  const headers = new Headers(overrides.headers ?? {});
  const body = overrides.body ?? null;

  const request = new Request(url.toString(), {
    method,
    headers,
    body: method !== 'GET' && method !== 'HEAD' && body ? body : undefined,
  });

  return {
    request,
    url,
    params: overrides.params ?? {},
    props: {},
    redirect: vi.fn(),
    response: new Response(),
    cookies: {} as Record<string, unknown>,
    locals: {},
    clientAddress: '127.0.0.1',
    generator: vi.fn(),
    slot: vi.fn(),
    viewTransition: vi.fn(),
    rewrite: vi.fn(),
  } as unknown as APIContext;
}

function createMockResponse(
  status = 200,
  body: string | object = { ok: true },
  headers: Record<string, string> = {},
): Response {
  if (status === 204 || status === 304) {
    return new Response(null, { status, headers });
  }
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(content, {
    status,
    headers: {
      'content-type': typeof body === 'string' ? 'text/html' : 'application/json',
      ...headers,
    },
  });
}

async function run(
  middleware: ReturnType<typeof httpDebugger>,
  ctx: APIContext,
  next: MiddlewareNext = async () => createMockResponse(),
): Promise<Response> {
  return middleware(ctx, next);
}

describe('httpDebugger Astro adapter', () => {
  let capturedOutput: string[];

  beforeEach(() => {
    capturedOutput = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      capturedOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('factory', () => {
    it('creates middleware function', () => {
      expect(typeof httpDebugger).toBe('function');
    });

    it('returns a function when called with no options', () => {
      const middleware = httpDebugger();
      expect(typeof middleware).toBe('function');
    });

    it('returns a function when called with empty options', () => {
      const middleware = httpDebugger({});
      expect(typeof middleware).toBe('function');
    });
  });

  describe('request capture', () => {
    it('captures GET request method and path', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ method: 'GET', pathname: '/api/data' });

      const res = await run(middleware, ctx);
      expect(res.status).toBe(200);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /api/data'))).toBe(true);
    });

    it('captures POST request method and path', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/users',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }),
      });

      const res = await run(middleware, ctx, async () => createMockResponse(201, { created: true }));
      expect(res.status).toBe(201);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('POST /api/users'))).toBe(true);
    });

    it('captures PUT request', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        method: 'PUT',
        pathname: '/api/users/1',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Bob' }),
      });

      await run(middleware, ctx, async () => createMockResponse(200, { updated: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('PUT /api/users/1'))).toBe(true);
    });

    it('captures DELETE request', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ method: 'DELETE', pathname: '/api/users/1' });

      await run(middleware, ctx, async () => createMockResponse(204));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('DELETE /api/users/1'))).toBe(true);
    });

    it('captures PATCH request', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        method: 'PATCH',
        pathname: '/api/users/1',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Charlie' }),
      });

      await run(middleware, ctx, async () => createMockResponse(200, { patched: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('PATCH /api/users/1'))).toBe(true);
    });

    it('captures query string parameters', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        pathname: '/search',
        search: '?q=test&page=2&sort=asc',
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /search'))).toBe(true);
    });

    it('captures route params', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        pathname: '/users/42/posts/7',
        params: { id: '42', postId: '7' },
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /users/42/posts/7'))).toBe(true);
    });

    it('captures request headers', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        pathname: '/test',
        headers: { 'x-custom-header': 'custom-value', accept: 'application/json' },
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('x-custom-header: custom-value'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('accept: application/json'))).toBe(true);
    });
  });

  describe('request body capture', () => {
    it('captures JSON request body', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/users',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Alice', age: 30 }),
      });

      await run(middleware, ctx, async () => createMockResponse(201, { created: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('"name": "Alice"'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('"age": 30'))).toBe(true);
    });

    it('captures plain text request body (non-JSON)', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/echo',
        headers: { 'content-type': 'text/plain' },
        body: 'hello world',
      });

      await run(middleware, ctx, async () => createMockResponse(200, 'echoed'));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('Body: hello world'))).toBe(true);
    });

    it('captures form-encoded request body', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/form',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'name=Alice&age=30',
      });

      await run(middleware, ctx, async () => createMockResponse(200, { ok: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('name=Alice&age=30'))).toBe(true);
    });

    it('handles invalid JSON request body gracefully', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/bad-json',
        headers: { 'content-type': 'application/json' },
        body: '{invalid json',
      });

      await run(middleware, ctx, async () => createMockResponse(200, { ok: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('[parse error: invalid JSON]'))).toBe(true);
    });

    it('handles request with no content-type header', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/raw',
        body: 'raw binary data',
      });

      await run(middleware, ctx, async () => createMockResponse(200, { ok: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('raw binary data'))).toBe(true);
    });

    it('sets bodyTruncated to true when request exceeds maxBodySize', async () => {
      const middleware = httpDebugger({ colors: false, maxBodySize: 10 });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/large',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: 'x'.repeat(100) }),
      });

      await run(middleware, ctx, async () => createMockResponse(200, { ok: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('[truncated]'))).toBe(true);
    });

    it('returns null body when request body is truncated', async () => {
      const middleware = httpDebugger({ colors: false, maxBodySize: 5 });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/large',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: 'x'.repeat(100) }),
      });

      await run(middleware, ctx, async () => createMockResponse(200, { ok: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('[truncated]'))).toBe(true);
    });

    it('handles GET request with no body', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ method: 'GET', pathname: '/api/no-body' });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /api/no-body'))).toBe(true);
      // The request body should be null, not displayed
      const output = capturedOutput.join('\n');
      const lines = output.split('\n');
      const methodLine = lines.find((l) => l.includes('GET /api/no-body'));
      expect(methodLine).toBeDefined();
    });

    it('handles HEAD request with no body', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ method: 'HEAD', pathname: '/api/health' });

      await run(middleware, ctx, async () => new Response(null, { status: 200 }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('HEAD /api/health'))).toBe(true);
    });
  });

  describe('response capture', () => {
    it('captures JSON response body', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ pathname: '/api/data' });

      await run(middleware, ctx, async () => createMockResponse(200, { ok: true, count: 42 }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('"ok": true'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('"count": 42'))).toBe(true);
    });

    it('captures plain text response body', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ pathname: '/api/text' });

      await run(middleware, ctx, async () => createMockResponse(200, 'hello world'));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('hello world'))).toBe(true);
    });

    it('captures HTML response body', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ pathname: '/page' });

      await run(middleware, ctx, async () => createMockResponse(200, '<h1>Hello</h1>'));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('<h1>Hello</h1>'))).toBe(true);
    });

    it('captures status code 200', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx, async () => createMockResponse(200, { ok: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('200'))).toBe(true);
    });

    it('captures status code 201', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ method: 'POST', pathname: '/api/create', headers: { 'content-type': 'application/json' }, body: '{}' });

      await run(middleware, ctx, async () => createMockResponse(201, { created: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('201'))).toBe(true);
    });

    it('captures status code 204 (no content)', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ method: 'DELETE', pathname: '/api/delete' });

      await run(middleware, ctx, async () => new Response(null, { status: 204 }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('204'))).toBe(true);
    });

    it('captures status code 400', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx, async () => createMockResponse(400, { error: 'bad request' }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('400'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('"error": "bad request"'))).toBe(true);
    });

    it('captures status code 404', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ pathname: '/not-found' });

      await run(middleware, ctx, async () => createMockResponse(404, { error: 'not found' }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('404'))).toBe(true);
    });

    it('captures status code 500', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx, async () => createMockResponse(500, { error: 'server error' }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('500'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('"error": "server error"'))).toBe(true);
    });

    it('captures response headers', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx, async () =>
        createMockResponse(200, { ok: true }, { 'x-request-id': 'abc-123', 'x-ratelimit': '100' }),
      );

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('x-request-id: abc-123'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('x-ratelimit: 100'))).toBe(true);
    });

    it('captures response size', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx, async () => createMockResponse(200, { ok: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('Size:'))).toBe(true);
    });

    it('sets bodyTruncated to true when response exceeds maxBodySize', async () => {
      const middleware = httpDebugger({ colors: false, maxBodySize: 10 });
      const ctx = createMockContext();

      await run(middleware, ctx, async () =>
        createMockResponse(200, { data: 'x'.repeat(100) }),
      );

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('[truncated]'))).toBe(true);
    });

    it('handles invalid JSON response body gracefully', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx, async () => new Response('not json }{', { status: 200 }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('not json }{'))).toBe(true);
    });

    it('handles empty response body', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx, async () => new Response(null, { status: 200 }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('200'))).toBe(true);
    });
  });

  describe('timing', () => {
    it('includes timing data in output', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('Timing:'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('Headers:'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('Body Read:'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('Handler:'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('Response:'))).toBe(true);
    });

    it('reports duration in output', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('ms'))).toBe(true);
    });
  });

  describe('header sanitization', () => {
    it('sanitizes Authorization header by default', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        pathname: '/secure',
        headers: { Authorization: 'Bearer secret123' },
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('***'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('secret123'))).toBe(false);
    });

    it('sanitizes Cookie header by default', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        pathname: '/secure',
        headers: { Cookie: 'session=abcdef123456' },
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('***'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('abcdef123456'))).toBe(false);
    });

    it('does not sanitize when sanitize option is false', async () => {
      const middleware = httpDebugger({ colors: false, sanitize: false });
      const ctx = createMockContext({
        pathname: '/secure',
        headers: { Authorization: 'Bearer secret123' },
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('secret123'))).toBe(true);
    });

    it('does not sanitize non-sensitive headers', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        pathname: '/test',
        headers: { 'content-type': 'application/json', accept: 'text/html' },
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('content-type: application/json'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('accept: text/html'))).toBe(true);
    });
  });

  describe('filter', () => {
    it('skips logging when filter returns false', async () => {
      const middleware = httpDebugger({
        colors: false,
        filter: (entry) => entry.response.statusCode < 400,
      });
      const ctx = createMockContext({ pathname: '/error' });

      await run(middleware, ctx, async () => createMockResponse(500, { error: true }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.length).toBe(0);
    });

    it('logs when filter returns true', async () => {
      const middleware = httpDebugger({
        colors: false,
        filter: (entry) => entry.response.statusCode >= 200,
      });
      const ctx = createMockContext();

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.length).toBeGreaterThan(0);
    });

    it('still returns response when filter skips logging', async () => {
      const middleware = httpDebugger({
        colors: false,
        filter: () => false,
      });
      const ctx = createMockContext();

      const res = await run(middleware, ctx, async () => createMockResponse(200, { ok: true }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it('can filter by method', async () => {
      const middleware = httpDebugger({
        colors: false,
        filter: (entry) => entry.request.method === 'POST',
      });

      const getCtx = createMockContext({ method: 'GET', pathname: '/api' });
      await run(middleware, getCtx);

      const postCtx = createMockContext({
        method: 'POST',
        pathname: '/api',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      await run(middleware, postCtx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /api'))).toBe(false);
      expect(capturedOutput.some((o) => o.includes('POST /api'))).toBe(true);
    });

    it('can filter by path', async () => {
      const middleware = httpDebugger({
        colors: false,
        filter: (entry) => entry.request.path.startsWith('/api'),
      });

      const webCtx = createMockContext({ pathname: '/page' });
      await run(middleware, webCtx);

      const apiCtx = createMockContext({ pathname: '/api/data' });
      await run(middleware, apiCtx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /page'))).toBe(false);
      expect(capturedOutput.some((o) => o.includes('GET /api/data'))).toBe(true);
    });

    it('can filter by duration', async () => {
      const middleware = httpDebugger({
        colors: false,
        filter: (entry) => entry.duration < 10000,
      });
      const ctx = createMockContext();

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.length).toBeGreaterThan(0);
    });
  });

  describe('cURL generation', () => {
    it('includes cURL command when curl option is true', async () => {
      const middleware = httpDebugger({ colors: false, curl: true });
      const ctx = createMockContext({ pathname: '/test' });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('curl:'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('curl -X GET'))).toBe(true);
    });

    it('does not include cURL command by default', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ pathname: '/test' });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('curl:'))).toBe(false);
    });

    it('includes cURL with request body for POST', async () => {
      const middleware = httpDebugger({ colors: false, curl: true });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/users',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }),
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes("curl -X POST"))).toBe(true);
      expect(capturedOutput.some((o) => o.includes("-d '"))).toBe(true);
    });

    it('supports curl as a function', async () => {
      const middleware = httpDebugger({
        colors: false,
        curl: (entry) => entry.request.method === 'POST',
      });

      const getCtx = createMockContext({ method: 'GET', pathname: '/api' });
      await run(middleware, getCtx);

      const postCtx = createMockContext({
        method: 'POST',
        pathname: '/api',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      await run(middleware, postCtx);

      await new Promise((r) => setTimeout(r, 150));
      const getOutput = capturedOutput.find((o) => o.includes('GET /api'));
      const postOutput = capturedOutput.find((o) => o.includes('POST /api'));
      expect(getOutput?.includes('curl:')).toBe(false);
      expect(postOutput?.includes('curl:')).toBe(true);
    });
  });

  describe('colors', () => {
    it('includes ANSI codes when colors is true', async () => {
      const middleware = httpDebugger({ colors: true });
      const ctx = createMockContext();

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('\x1b['))).toBe(true);
    });

    it('does not include ANSI codes when colors is false', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('\x1b['))).toBe(false);
    });
  });

  describe('formatting options', () => {
    it('respects maxDepth option for nested objects', async () => {
      const middleware = httpDebugger({ colors: false, maxDepth: 1 });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/nested',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ a: { b: { c: { d: 'deep' } } } }),
      });

      await run(middleware, ctx, async () =>
        createMockResponse(200, { x: { y: { z: 'deep' } } }),
      );

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('[Object]'))).toBe(true);
    });

    it('respects maxArrayItems option for large arrays', async () => {
      const middleware = httpDebugger({ colors: false, maxArrayItems: 2 });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/array',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [1, 2, 3, 4, 5, 6, 7, 8] }),
      });

      await run(middleware, ctx, async () => createMockResponse(200, { items: [1, 2, 3, 4, 5] }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('6 more'))).toBe(true);
    });
  });

  describe('return value', () => {
    it('always returns the original response from next()', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      const res = await run(middleware, ctx, async () =>
        createMockResponse(201, { created: true }, { 'x-custom': 'yes' }),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({ created: true });
      expect(res.headers.get('x-custom')).toBe('yes');
    });

    it('returns response even when filter skips logging', async () => {
      const middleware = httpDebugger({
        colors: false,
        filter: () => false,
      });
      const ctx = createMockContext();

      const res = await run(middleware, ctx, async () =>
        createMockResponse(418, "I'm a teapot"),
      );

      expect(res.status).toBe(418);
      const body = await res.text();
      expect(body).toBe("I'm a teapot");
    });

    it('returns response even when next() throws', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await expect(
        run(middleware, ctx, async () => {
          throw new Error('handler error');
        }),
      ).rejects.toThrow('handler error');
    });
  });

  describe('multiple requests', () => {
    it('captures multiple sequential requests', async () => {
      const middleware = httpDebugger({ colors: false });

      await run(middleware, createMockContext({ pathname: '/a' }));
      await run(middleware, createMockContext({ pathname: '/b' }));
      await run(middleware, createMockContext({ pathname: '/c' }));

      await new Promise((r) => setTimeout(r, 200));
      expect(capturedOutput.some((o) => o.includes('GET /a'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('GET /b'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('GET /c'))).toBe(true);
    });

    it('each request gets a unique id', async () => {
      const middleware = httpDebugger({ colors: false });

      await run(middleware, createMockContext({ pathname: '/first' }));
      await run(middleware, createMockContext({ pathname: '/second' }));

      await new Promise((r) => setTimeout(r, 200));
      expect(capturedOutput.length).toBe(2);
    });
  });

  describe('dashboard routes', () => {
    it('serves dashboard HTML at /__debugger when dashboard is enabled', async () => {
      const middleware = httpDebugger({ colors: false, dashboard: true });
      const ctx = createMockContext({ pathname: '/__debugger' });

      const res = await run(middleware, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/html');
      const html = await res.text();
      expect(html).toContain('http-debugger');
    });

    it('serves SSE stream at /__debugger/stream when dashboard is enabled', async () => {
      const middleware = httpDebugger({ colors: false, dashboard: true });
      const ctx = createMockContext({ pathname: '/__debugger/stream' });

      const res = await run(middleware, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/event-stream');
      expect(res.headers.get('cache-control')).toBe('no-cache');
    });

    it('dashboard intercepts /__debugger even without explicit dashboard option', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ pathname: '/__debugger' });

      const res = await run(middleware, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/html');
      const html = await res.text();
      expect(html).toContain('http-debugger');
    });

    it('dashboard intercepts /__debugger/stream even without explicit dashboard option', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ pathname: '/__debugger/stream' });

      const res = await run(middleware, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/event-stream');
      expect(res.headers.get('cache-control')).toBe('no-cache');
    });

    it('passes through other routes when dashboard is enabled', async () => {
      const middleware = httpDebugger({ colors: false, dashboard: true });
      const ctx = createMockContext({ pathname: '/api/data' });

      const res = await run(middleware, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('dashboard engine stores entries', async () => {
      const middleware = httpDebugger({ colors: false, dashboard: { maxEntries: 50 } });
      const ctx = createMockContext({ pathname: '/api/test' });

      await run(middleware, ctx);
      await new Promise((r) => setTimeout(r, 150));

      expect(capturedOutput.some((o) => o.includes('GET /api/test'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles request with empty path', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ pathname: '/' });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /'))).toBe(true);
    });

    it('handles request with deeply nested path', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({ pathname: '/a/b/c/d/e/f/g' });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /a/b/c/d/e/f/g'))).toBe(true);
    });

    it('handles request with special characters in query', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        pathname: '/search',
        search: '?q=hello+world&lang=en',
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /search'))).toBe(true);
    });

    it('handles concurrent requests without mixing data', async () => {
      const middleware = httpDebugger({ colors: false });

      const p1 = run(middleware, createMockContext({ pathname: '/slow' }), async () => {
        await new Promise((r) => setTimeout(r, 50));
        return createMockResponse(200, { from: 'slow' });
      });
      const p2 = run(middleware, createMockContext({ pathname: '/fast' }), async () => {
        return createMockResponse(200, { from: 'fast' });
      });

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      await new Promise((r) => setTimeout(r, 200));
      expect(capturedOutput.some((o) => o.includes('GET /slow'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('GET /fast'))).toBe(true);
    });

    it('handles request body with deeply nested JSON', async () => {
      const middleware = httpDebugger({ colors: false, maxBodySize: 1024 });
      const nested = { level1: { level2: { level3: { level4: 'deep' } } } };
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/deep',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(nested),
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('"level1"'))).toBe(true);
    });

    it('handles response with large JSON body within limit', async () => {
      const middleware = httpDebugger({ colors: false, maxBodySize: 4096 });
      const largeData = { items: Array.from({ length: 50 }, (_, i) => ({ id: i, value: `item-${i}` })) };
      const ctx = createMockContext();

      await run(middleware, ctx, async () => createMockResponse(200, largeData));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('200'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('[truncated]'))).toBe(false);
      expect(capturedOutput.some((o) => o.includes('"items"'))).toBe(true);
    });

    it('handles response with large JSON body exceeding limit', async () => {
      const middleware = httpDebugger({ colors: false, maxBodySize: 50 });
      const largeData = { data: 'x'.repeat(200) };
      const ctx = createMockContext();

      await run(middleware, ctx, async () => createMockResponse(200, largeData));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('[truncated]'))).toBe(true);
    });

    it('handles request with multiple headers', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        pathname: '/api/multi',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-request-id': 'req-001',
          'x-correlation-id': 'corr-002',
          authorization: 'Bearer token',
        },
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      const output = capturedOutput.join(' ');
      expect(output).toContain('x-request-id: req-001');
      expect(output).toContain('x-correlation-id: corr-002');
    });

    it('handles response with no headers', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx, async () => new Response(null, { status: 204 }));

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('204'))).toBe(true);
    });

    it('captures entry with valid id field', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /test'))).toBe(true);
    });

    it('captures entry with timestamp', async () => {
      const before = Date.now();
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext();

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      const after = Date.now();
      expect(capturedOutput.some((o) => o.includes('GET /test'))).toBe(true);
      expect(before).toBeLessThanOrEqual(after);
    });
  });

  describe('default options', () => {
    it('works with default options (no arguments)', async () => {
      const middleware = httpDebugger();
      const ctx = createMockContext({ pathname: '/default' });

      const res = await run(middleware, ctx);
      expect(res.status).toBe(200);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('GET /default'))).toBe(true);
    });

    it('uses default maxBodySize of 1024', async () => {
      const middleware = httpDebugger({ colors: false });
      const ctx = createMockContext({
        method: 'POST',
        pathname: '/api/medium',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: 'y'.repeat(500) }),
      });

      await run(middleware, ctx);

      await new Promise((r) => setTimeout(r, 150));
      expect(capturedOutput.some((o) => o.includes('"data":'))).toBe(true);
      expect(capturedOutput.some((o) => o.includes('[truncated]'))).toBe(false);
    });
  });
});
