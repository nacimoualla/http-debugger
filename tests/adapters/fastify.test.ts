import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { httpDebugger } from '../../src/adapters/fastify.js';

describe('httpDebugger Fastify adapter', () => {
  let app: FastifyInstance;
  let capturedOutput: string[];

  beforeEach(async () => {
    capturedOutput = [];
    app = Fastify();
    await app.register(httpDebugger, { colors: false });

    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      capturedOutput.push(args.join(' '));
    });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('creates middleware function', () => {
    expect(typeof httpDebugger).toBe('function');
  });

  it('captures res.json() response', async () => {
    app.get('/test', async () => {
      return { ok: true };
    });

    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/test' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('GET /test'))).toBe(true);
    expect(capturedOutput.some((o) => o.includes('200'))).toBe(true);
  });

  it('captures request body', async () => {
    app.post('/users', async (request) => {
      return { received: request.body };
    });

    await app.ready();
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Alice' },
    });

    expect(response.statusCode).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('POST /users'))).toBe(true);
    expect(capturedOutput.some((o) => o.includes('"name": "Alice"'))).toBe(true);
  });

  it('sanitizes Authorization header', async () => {
    app.get('/secure', async () => {
      return { ok: true };
    });

    await app.ready();
    const response = await app.inject({
      method: 'GET',
      url: '/secure',
      headers: { authorization: 'Bearer secret123' },
    });

    expect(response.statusCode).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('***'))).toBe(true);
    expect(capturedOutput.some((o) => o.includes('secret123'))).toBe(false);
  });

  it('reports 500 errors', async () => {
    app.get('/error', async () => {
      throw new Error('fail');
    });

    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/error' });

    expect(response.statusCode).toBe(500);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('500'))).toBe(true);
  });

  it('captures cURL command when enabled', async () => {
    const curlApp = Fastify();
    curlApp.register(httpDebugger, { colors: false, curl: true });

    curlApp.get('/test', async () => {
      return { ok: true };
    });

    await curlApp.ready();
    const response = await curlApp.inject({ method: 'GET', url: '/test' });

    expect(response.statusCode).toBe(200);

    await new Promise((r) => setTimeout(r, 150));
    expect(capturedOutput.some((o) => o.includes('curl:'))).toBe(true);
    await curlApp.close();
  });
});
