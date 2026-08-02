import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Elysia } from 'elysia';
import { httpDebugger } from '../../src/adapters/elysia';

describe('httpDebugger Elysia adapter', () => {
  let app: Elysia;
  let capturedOutput: string[];

  beforeEach(() => {
    capturedOutput = [];
    app = new Elysia().use(httpDebugger({ colors: false }));

    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      capturedOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates middleware function', () => {
    expect(typeof httpDebugger).toBe('function');
  });

  it('captures json response', async () => {
    app.get('/test', () => {
      return { ok: true };
    });

    const res = await app.handle(new Request('http://localhost:3000/test'));
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('GET /test'))).toBe(true);
    expect(capturedOutput.some((o) => o.includes('200'))).toBe(true);
  });

  it('captures request body', async () => {
    app.post('/users', ({ body }) => {
      return { received: body };
    });

    const res = await app.handle(
      new Request('http://localhost:3000/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }),
      }),
    );

    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('POST /users'))).toBe(true);
    expect(capturedOutput.some((o) => o.includes('"name": "Alice"'))).toBe(true);
  });

  it('sanitizes Authorization header', async () => {
    app.get('/secure', () => {
      return { ok: true };
    });

    const res = await app.handle(
      new Request('http://localhost:3000/secure', {
        headers: { Authorization: 'Bearer secret123' },
      }),
    );

    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('***'))).toBe(true);
    expect(capturedOutput.some((o) => o.includes('secret123'))).toBe(false);
  });

  it('captures cURL command when enabled', async () => {
    const curlApp = new Elysia().use(httpDebugger({ colors: false, curl: true }));

    curlApp.get('/test', () => {
      return { ok: true };
    });

    const res = await curlApp.handle(new Request('http://localhost:3000/test'));
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('curl'))).toBe(true);
  });

  it('handles null body (GET request)', async () => {
    app.get('/no-body', () => {
      return { ok: true };
    });

    const res = await app.handle(new Request('http://localhost:3000/no-body'));
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('GET /no-body'))).toBe(true);
  });
});
