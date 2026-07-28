# Next.js Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Next.js adapter with HOF wrapper for App Router Route Handlers and catch-all dashboard route.

**Architecture:** HOF `withHttpDebugger(handler)` wraps individual route handlers. `dashboardRoute()` provides a catch-all route for the dashboard. A singleton engine on `globalThis` survives Next.js HMR.

**Tech Stack:** TypeScript, Web Fetch API (Request/Response), Vitest

## Global Constraints

- Zero runtime dependencies
- Web Fetch API only (Request/Response clones, ReadableStream) — edge-compatible
- Singleton engine on `globalThis` for HMR survival
- Production guard: `NODE_ENV=production` silently disables dashboard
- Teardown on disconnect: every SSE client must be cleaned up
- Hydration: new SSE clients receive historical entries immediately
- Ring buffer: max 100 entries by default, configurable via `dashboard.maxEntries`

---

### Task 1: Create Singleton Engine

**Files:**
- Create: `src/core/singleton.ts`
- Create: `tests/core/singleton.test.ts`

**Interfaces:**
- Produces: `engine` (singleton `DashboardEngine` instance)
- Produces: `setDashboardOptions(options: DashboardOptions)` — stores formatting options

- [ ] **Step 0: Add DashboardEngine type export to src/core/dashboard.ts**

Add at the end of the file (after the `createDashboardEngine` function):

```typescript
export type DashboardEngine = ReturnType<typeof createDashboardEngine>;
```

- [ ] **Step 1: Create src/core/singleton.ts**

```typescript
import { createDashboardEngine, type DashboardEngine } from './dashboard.js';
import type { DashboardOptions } from '../types.js';

const globalForDebugger = globalThis as unknown as {
  __httpDebuggerEngine: DashboardEngine | undefined;
  __httpDebuggerOptions: DashboardOptions | undefined;
};

export const engine: DashboardEngine =
  globalForDebugger.__httpDebuggerEngine ?? createDashboardEngine();

if (process.env.NODE_ENV !== 'production') {
  globalForDebugger.__httpDebuggerEngine = engine;
}

export function setDashboardOptions(options: DashboardOptions): void {
  const globalForOptions = globalThis as unknown as {
    __httpDebuggerOptions: DashboardOptions | undefined;
  };
  if (process.env.NODE_ENV !== 'production') {
    globalForOptions.__httpDebuggerOptions = options;
  }
}

export function getDashboardOptions(): DashboardOptions {
  const globalForOptions = globalThis as unknown as {
    __httpDebuggerOptions: DashboardOptions | undefined;
  };
  return globalForOptions.__httpDebuggerOptions ?? {};
}
```

- [ ] **Step 2: Create tests/core/singleton.test.ts**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { engine, setDashboardOptions, getDashboardOptions } from '../../src/core/singleton.js';

describe('singleton engine', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('exports a valid engine', () => {
    expect(engine).toBeDefined();
    expect(typeof engine.addEntry).toBe('function');
    expect(typeof engine.addClientWithHistory).toBe('function');
    expect(typeof engine.isEnabled).toBe('boolean');
  });

  it('preserves same engine instance across imports', () => {
    const engine1 = engine;
    const engine2 = engine;
    expect(engine1).toBe(engine2);
  });

  it('stores and retrieves dashboard options', () => {
    setDashboardOptions({ maxDepth: 6, sanitize: false });
    const opts = getDashboardOptions();
    expect(opts.maxDepth).toBe(6);
    expect(opts.sanitize).toBe(false);
  });

  it('returns empty object when no options set', () => {
    const opts = getDashboardOptions();
    expect(opts).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/core/singleton.test.ts`
Expected: All tests PASS

- [ ] **Step 3.5: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/dashboard.ts src/core/singleton.ts tests/core/singleton.test.ts
git commit -m "feat: add singleton engine with globalThis HMR survival"
```

---

### Task 2: Add DashboardOptions Type

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `DashboardOptions` type

- [ ] **Step 1: Add DashboardOptions to src/types.ts**

Add after `MiddlewareOptions`:

```typescript
/** Configuration options for the Next.js dashboard route. */
export interface DashboardOptions extends MiddlewareOptions {
  /** Max entries in ring buffer (default: 100). */
  maxEntries?: number;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add DashboardOptions type"
```

---

### Task 3: Create readBodyWithLimit Utility

**Files:**
- Create: `src/core/stream.ts`
- Create: `tests/core/stream.test.ts`

**Interfaces:**
- Produces: `readBodyWithLimit(stream: ReadableStream | null, maxBodySize: number): Promise<{ body: string; truncated: boolean }>`

- [ ] **Step 1: Create src/core/stream.ts**

```typescript
/**
 * Reads a ReadableStream with a byte limit, returning the body as a string.
 * If the stream exceeds maxBodySize, returns truncated: true and partial body.
 */
export async function readBodyWithLimit(
  stream: ReadableStream | null,
  maxBodySize: number,
): Promise<{ body: string; truncated: boolean }> {
  if (!stream) return { body: '', truncated: false };

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.length;
    if (totalBytes <= maxBodySize) {
      chunks.push(value);
    } else {
      const remaining = maxBodySize - chunks.reduce((acc, c) => acc + c.length, 0);
      if (remaining > 0) {
        chunks.push(value.subarray(0, remaining));
      }
      truncated = true;
      reader.cancel();
      break;
    }
  }

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  const decoder = new TextDecoder();
  return { body: decoder.decode(combined), truncated };
}
```

- [ ] **Step 2: Create tests/core/stream.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { readBodyWithLimit } from '../../src/core/stream.js';

describe('readBodyWithLimit', () => {
  it('returns empty string for null stream', async () => {
    const result = await readBodyWithLimit(null, 1024);
    expect(result.body).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('reads body within limit', async () => {
    const data = new TextEncoder().encode('hello world');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 1024);
    expect(result.body).toBe('hello world');
    expect(result.truncated).toBe(false);
  });

  it('truncates body exceeding limit', async () => {
    const data = new TextEncoder().encode('x'.repeat(2048));
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 1024);
    expect(result.body.length).toBeLessThanOrEqual(1024);
    expect(result.truncated).toBe(true);
  });

  it('handles multiple chunks', async () => {
    const chunk1 = new TextEncoder().encode('hello ');
    const chunk2 = new TextEncoder().encode('world');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.close();
      },
    });
    const result = await readBodyWithLimit(stream, 1024);
    expect(result.body).toBe('hello world');
    expect(result.truncated).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/core/stream.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/stream.ts tests/core/stream.test.ts
git commit -m "feat: add readBodyWithLimit utility for Web Streams"
```

---

### Task 4: Create withHttpDebugger HOF

**Files:**
- Create: `src/next.ts`
- Create: `tests/adapters/next.test.ts`

**Interfaces:**
- Consumes: `engine`, `getDashboardOptions` from `src/core/singleton.ts`
- Consumes: `readBodyWithLimit` from `src/core/stream.ts`
- Consumes: `createTiming` from `src/core/timing.ts`
- Consumes: `generateId` from `src/core/capture.ts`
- Consumes: `formatEntry` from `src/core/formatter.ts`
- Produces: `withHttpDebugger(handler, options?)` function

- [ ] **Step 1: Create src/next.ts**

```typescript
import type { MiddlewareOptions } from './types.js';
import { engine, getDashboardOptions } from './core/singleton.js';
import { readBodyWithLimit } from './core/stream.js';
import { createTiming } from './core/timing.js';
import { generateId } from './core/capture.js';
import { formatEntry } from './core/formatter.js';

export function withHttpDebugger(
  handler: (req: Request) => Promise<Response> | Response,
  handlerOptions?: MiddlewareOptions,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (!engine.isEnabled) {
      return handler(req);
    }

    const timing = createTiming();
    const id = generateId();
    const maxBodySize = handlerOptions?.maxBodySize ?? 1024;

    timing.markHeadersReceived();

    const reqClone = req.clone();
    const { body: reqBodyStr, truncated: reqTruncated } = await readBodyWithLimit(
      reqClone.body,
      maxBodySize,
    );

    let reqBody: unknown = null;
    if (reqBodyStr) {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          reqBody = JSON.parse(reqBodyStr);
        } catch {
          reqBody = '[parse error: invalid JSON]';
        }
      } else {
        reqBody = reqBodyStr;
      }
    }

    timing.markBodyComplete();
    timing.markHandlerStart();

    const res = await handler(req);

    timing.markHandlerEnd();

    const resClone = res.clone();

    // Fire and forget: process the clone in the background
    // This avoids blocking streaming responses (SSE, AI text streams, etc.)
    (async () => {
      timing.markResponseStart();

      const { body: resBodyStr, truncated: resTruncated } = await readBodyWithLimit(
        resClone.body,
        maxBodySize,
      );

      let resBody: unknown = null;
      if (resBodyStr) {
        try {
          resBody = JSON.parse(resBodyStr);
        } catch {
          resBody = resBodyStr;
        }
      }

      timing.markResponseEnd();

      const entry = {
        id,
        timestamp: Date.now(),
        request: {
          method: req.method,
          path: new URL(req.url).pathname,
          headers: Object.fromEntries(req.headers.entries()) as Record<string, string>,
          body: reqTruncated ? null : reqBody,
          bodyTruncated: reqTruncated,
          query: Object.fromEntries(new URL(req.url).searchParams),
          params: {},
        },
        response: {
          statusCode: res.status,
          headers: Object.fromEntries(res.headers.entries()) as Record<string, string>,
          body: resTruncated ? null : resBody,
          bodyTruncated: resTruncated,
          size: resBodyStr ? Buffer.byteLength(resBodyStr) : 0,
        },
        timing: timing.toJSON(),
        duration: timing.duration,
      };

      const dashboardOpts = getDashboardOptions();
      const mergedOptions = { ...dashboardOpts, ...handlerOptions };

      if (mergedOptions.filter && !mergedOptions.filter(entry)) return;

      console.log(
        formatEntry(entry, {
          colors: mergedOptions.colors,
          sanitize: mergedOptions.sanitize,
          maxDepth: mergedOptions.maxDepth,
          maxArrayItems: mergedOptions.maxArrayItems,
          curl: mergedOptions.curl,
        }),
      );

      engine.addEntry(entry as any);
    })();

    // Return the original response instantly so streaming works flawlessly
    return res;
  };
}
```

- [ ] **Step 2: Add exports to src/index.ts**

Add at the end of `src/index.ts`:

```typescript
export { withHttpDebugger } from './next.js';
export { dashboardRoute } from './next.js';
export type { DashboardOptions } from './types.js';
```

- [ ] **Step 3: Create tests/adapters/next.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withHttpDebugger } from '../../src/next.js';
import { engine } from '../../src/core/singleton.js';

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
    // Response processing is non-blocking, wait for background task
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
    expect(received).toContain('POST /api/test');
  });

  it('does not log when filter returns false', async () => {
    const handler = async (req: Request) => {
      return Response.json({ ok: true });
    };
    const wrapped = withHttpDebugger(handler, {
      colors: false,
      filter: (entry) => entry.response.statusCode < 400,
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
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/adapters/next.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/next.ts src/index.ts tests/adapters/next.test.ts
git commit -m "feat: add withHttpDebugger HOF for Next.js App Router"
```

---

### Task 5: Create dashboardRoute

**Files:**
- Modify: `src/next.ts`
- Modify: `tests/adapters/next.test.ts`

**Interfaces:**
- Consumes: `engine`, `setDashboardOptions` from `src/core/singleton.ts`
- Consumes: `DASHBOARD_HTML` from `src/core/dashboard.ts`
- Produces: `dashboardRoute(options?)` function

- [ ] **Step 1: Add dashboardRoute to src/next.ts**

Add at the end of `src/next.ts`:

```typescript
export function dashboardRoute(
  options?: DashboardOptions,
): (req: Request) => Promise<Response> {
  if (options) {
    setDashboardOptions(options);
  }

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.endsWith('/stream')) {
      let teardown: (() => void) | undefined;
      const stream = new ReadableStream({
        start(controller) {
          const sendFn = (chunk: string) => {
            controller.enqueue(new TextEncoder().encode(chunk));
          };
          teardown = engine.addClientWithHistory(sendFn);
        },
        cancel() {
          teardown?.();
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return new Response(DASHBOARD_HTML, {
      headers: { 'Content-Type': 'text/html' },
    });
  };
}
```

- [ ] **Step 2: Add tests to tests/adapters/next.test.ts**

Add at the end of the test file:

```typescript
describe('dashboardRoute', () => {
  it('serves HTML at __debugger path', async () => {
    const { dashboardRoute } = await import('../../src/next.js');
    const handler = dashboardRoute();
    const req = new Request('http://localhost/__debugger');
    const res = await handler(req);
    expect(res.headers.get('content-type')).toBe('text/html');
    const html = await res.text();
    expect(html).toContain('http-debugger');
  });

  it('serves SSE at __debugger/stream path', async () => {
    const { dashboardRoute } = await import('../../src/next.js');
    const handler = dashboardRoute();
    const req = new Request('http://localhost/__debugger/stream');
    const res = await handler(req);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('configures engine options', async () => {
    const { dashboardRoute } = await import('../../src/next.js');
    const { getDashboardOptions } = await import('../../src/core/singleton.js');
    dashboardRoute({ maxDepth: 6, sanitize: false });
    const opts = getDashboardOptions();
    expect(opts.maxDepth).toBe(6);
    expect(opts.sanitize).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/adapters/next.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/next.ts tests/adapters/next.test.ts
git commit -m "feat: add dashboardRoute for Next.js catch-all route"
```

---

### Task 6: Update Package Config

**Files:**
- Modify: `package.json`
- Modify: `tsup.config.ts`

**Interfaces:**
- None (configuration only)

- [ ] **Step 1: Add ./next export to package.json**

Add after `"./types"` export:

```json
    "./next": {
      "types": "./dist/next.d.ts",
      "import": "./dist/next.js",
      "require": "./dist/next.cjs"
    }
```

- [ ] **Step 2: Add src/next.ts to tsup.config.ts**

Modify the `entry` array in `tsup.config.ts`:

```typescript
entry: [
  'src/index.ts',
  'src/adapters/express.ts',
  'src/adapters/fastify.ts',
  'src/adapters/hono.ts',
  'src/next.ts',
],
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Build and verify exports**

Run:
```bash
npm run build
node --input-type=module -e "import { withHttpDebugger, dashboardRoute } from './dist/next.js'; console.log('next OK')"
```

Expected: Prints "next OK"

- [ ] **Step 5: Commit**

```bash
git add package.json tsup.config.ts
git commit -m "chore: add ./next export and build entry"
```

---

### Task 7: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Verify all exports**

Run:
```bash
node --input-type=module -e "
import { withHttpDebugger, dashboardRoute } from './dist/next.js';
console.log('next OK');
console.log('withHttpDebugger:', typeof withHttpDebugger);
console.log('dashboardRoute:', typeof dashboardRoute);
"
```

Expected: Both functions are functions

- [ ] **Step 5: Final commit if needed**

```bash
git add .
git commit -m "chore: final verification for Next.js adapter" --allow-empty
```
