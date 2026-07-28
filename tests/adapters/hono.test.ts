import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { httpDebugger } from '../../src/adapters/hono.js';

describe('httpDebugger Hono adapter', () => {
  let app: Hono;
  let capturedOutput: string[];

  beforeEach(() => {
    capturedOutput = [];
    app = new Hono();
    app.use('*', httpDebugger({ colors: false }));

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
    app.get('/test', (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/test');
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('GET /test'))).toBe(true);
    expect(capturedOutput.some((o) => o.includes('200'))).toBe(true);
  });

  it('captures request body', async () => {
    app.post('/users', async (c) => {
      const body = await c.req.json();
      return c.json({ received: body }, 201);
    });

    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    expect(res.status).toBe(201);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('POST /users'))).toBe(true);
    expect(capturedOutput.some((o) => o.includes('"name": "Alice"'))).toBe(true);
  });

  it('sanitizes Authorization header', async () => {
    app.get('/secure', (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/secure', {
      headers: { Authorization: 'Bearer secret123' },
    });

    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('***'))).toBe(true);
    expect(capturedOutput.some((o) => o.includes('secret123'))).toBe(false);
  });

  it('captures cURL command when enabled', async () => {
    const curlApp = new Hono();
    curlApp.use('*', httpDebugger({ colors: false, curl: true }));

    curlApp.get('/test', (c) => {
      return c.json({ ok: true });
    });

    const res = await curlApp.request('/test');
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('curl:'))).toBe(true);
  });

  it('handles null body (GET request)', async () => {
    app.get('/no-body', (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/no-body');
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('GET /no-body'))).toBe(true);
  });
});
