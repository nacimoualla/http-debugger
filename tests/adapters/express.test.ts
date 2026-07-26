import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Request, Response } from 'express';
import { httpDebugger } from '../../src/adapters/express.js';

describe('httpDebugger Express adapter', () => {
  let app: express.Express;
  let server: ReturnType<typeof express.application.listen>;
  let capturedOutput: string[];

  beforeEach(() => {
    capturedOutput = [];
    app = express();
    app.use(httpDebugger({ colors: false }));

    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      capturedOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    server?.close();
    vi.restoreAllMocks();
  });

  function startServer(): Promise<number> {
    return new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as { port: number }).port;
        resolve(port);
      });
    });
  }

  function waitForLog(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 150));
  }

  it('creates middleware function', () => {
    const middleware = httpDebugger();
    expect(typeof middleware).toBe('function');
  });

  it('captures res.json() response', async () => {
    app.get('/test', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/test`);
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('GET /test'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('200'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('"ok": true'))).toBe(true);
  });

  it('captures res.send() response', async () => {
    app.get('/html', (_req: Request, res: Response) => {
      res.send('<h1>Hello</h1>');
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/html`);
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('GET /html'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('<h1>Hello</h1>'))).toBe(true);
  });

  it('captures res.sendStatus() response', async () => {
    app.get('/no-content', (_req: Request, res: Response) => {
      res.sendStatus(204);
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/no-content`);
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('204'))).toBe(true);
  });

  it('captures res.write() + res.end() response', async () => {
    app.get('/stream', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/plain');
      res.write('chunk1');
      res.write('chunk2');
      res.end('chunk3');
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/stream`);
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('GET /stream'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('chunk1chunk2chunk3'))).toBe(true);
  });

  it('captures request body from raw stream (no body-parser)', async () => {
    app.post('/users', (req: Request, res: Response) => {
      res.status(201).json({ received: true });
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('POST /users'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('"name": "Alice"'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('201'))).toBe(true);
  });

  it('sanitizes Authorization header', async () => {
    app.get('/secure', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/secure`, {
      headers: { Authorization: 'Bearer secret123' },
    });
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('***'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('secret123'))).toBe(false);
  });

  it('reports 500 errors', async () => {
    app.get('/error', (_req: Request, res: Response) => {
      res.status(500).json({ error: 'fail' });
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/error`);
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('500'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('"error": "fail"'))).toBe(true);
  });

  it('does not crash the request on internal errors', async () => {
    app.get('/crash', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const port = await startServer();
    const response = await fetch(`http://localhost:${port}/crash`);
    await waitForLog();

    expect(response.status).toBe(200);
  });

  it('does not buffer large responses beyond maxBodySize', async () => {
    app.use(httpDebugger({ colors: false, maxBodySize: 1024 }));

    app.get('/large', (_req: Request, res: Response) => {
      const largeData = 'x'.repeat(100 * 1024);
      res.send(largeData);
    });

    const port = await startServer();
    const response = await fetch(`http://localhost:${port}/large`);
    await waitForLog();

    expect(response.status).toBe(200);
    expect(capturedOutput.some(o => o.includes('[truncated'))).toBe(true);
  });
});
