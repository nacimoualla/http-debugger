import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withHttpDebugger, dashboardRoute } from '../../src/next.js';
import { engine, getDashboardOptions } from '../../src/core/singleton.js';

describe('withHttpDebugger', () => {
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

  it('creates a wrapped handler', async () => {
    const handler = async (req: Request) => {
      return Response.json({ ok: true });
    };
    const wrapped = withHttpDebugger(handler);
    expect(typeof wrapped).toBe('function');
  });

  it('passes request through to handler', async () => {
    const handler = async (req: Request) => {
      const data = await req.json();
      return Response.json({ received: data });
    };
    const wrapped = withHttpDebugger(handler);

    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    const res = await wrapped(req);
    const data = await res.json();
    expect(data).toEqual({ received: { name: 'Alice' } });
  });

  it('captures request body', async () => {
    const handler = async (req: Request) => {
      return Response.json({ ok: true });
    };
    const wrapped = withHttpDebugger(handler, { colors: false });

    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    await wrapped(req);
    await new Promise((r) => setTimeout(r, 200));

    expect(capturedOutput.some((o) => o.includes('POST /api/users'))).toBe(true);
    expect(capturedOutput.some((o) => o.includes('"name": "Alice"'))).toBe(true);
  });

  it('captures response body', async () => {
    const handler = async (req: Request) => {
      return Response.json({ id: 1 });
    };
    const wrapped = withHttpDebugger(handler, { colors: false });

    const req = new Request('http://localhost/api/test');
    await wrapped(req);
    await new Promise((r) => setTimeout(r, 200));

    expect(capturedOutput.some((o) => o.includes('"id": 1'))).toBe(true);
  });

  it('captures status code', async () => {
    const handler = async (req: Request) => {
      return new Response(null, { status: 204 });
    };
    const wrapped = withHttpDebugger(handler, { colors: false });

    const req = new Request('http://localhost/api/no-content');
    await wrapped(req);
    await new Promise((r) => setTimeout(r, 200));

    expect(capturedOutput.some((o) => o.includes('204'))).toBe(true);
  });

  it('captures timing', async () => {
    const handler = async (req: Request) => {
      return Response.json({ ok: true });
    };
    const wrapped = withHttpDebugger(handler, { colors: false });

    const req = new Request('http://localhost/api/test');
    await wrapped(req);
    await new Promise((r) => setTimeout(r, 200));

    expect(capturedOutput.some((o) => o.includes('Timing:'))).toBe(true);
  });

  it('pushes entry to singleton engine', async () => {
    const handler = async (req: Request) => {
      return Response.json({ ok: true });
    };
    const wrapped = withHttpDebugger(handler, { colors: false });

    const req = new Request('http://localhost/api/test');
    await wrapped(req);
    await new Promise((r) => setTimeout(r, 200));

    let received = '';
    engine.addClientWithHistory((chunk) => { received += chunk; });
    expect(received).toContain('"method":"POST"');
    expect(received).toContain('"/api/test"');
  });

  it('does not log when filter returns false', async () => {
    const handler = async (req: Request) => {
      return Response.json({ ok: true });
    };
    const wrapped = withHttpDebugger(handler, {
      colors: false,
      filter: (entry) => entry.response.statusCode >= 400,
    });

    const req = new Request('http://localhost/api/test');
    await wrapped(req);
    await new Promise((r) => setTimeout(r, 200));

    expect(capturedOutput.length).toBe(0);
  });

  it('returns response instantly without blocking', async () => {
    const handler = async (req: Request) => {
      return Response.json({ ok: true });
    };
    const wrapped = withHttpDebugger(handler, { colors: false });

    const req = new Request('http://localhost/api/test');
    const start = Date.now();
    const res = await wrapped(req);
    const elapsed = Date.now() - start;

    // Response should return immediately (under 50ms), not blocked by body capture
    expect(elapsed).toBeLessThan(50);
    expect(res.status).toBe(200);
  });
});

describe('dashboardRoute', () => {
  it('serves HTML at __debugger path', async () => {
    const handler = dashboardRoute();
    const req = new Request('http://localhost/__debugger');
    const res = await handler(req);
    expect(res.headers.get('content-type')).toBe('text/html');
    const html = await res.text();
    expect(html).toContain('http-debugger');
  });

  it('serves SSE at __debugger/stream path', async () => {
    const handler = dashboardRoute();
    const req = new Request('http://localhost/__debugger/stream');
    const res = await handler(req);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('configures engine options', async () => {
    dashboardRoute({ maxDepth: 6, sanitize: false });
    const opts = getDashboardOptions();
    expect(opts.maxDepth).toBe(6);
    expect(opts.sanitize).toBe(false);
  });
});
