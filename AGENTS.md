# AGENTS.md — Rules for AI Assistants

## Documentation Site Rules (CRITICAL)

1. **NEVER put specs, plans, or brainstorming docs inside `docs/`**
   - VitePress renders ALL `.md` files in `docs/` as pages
   - Specs/plans go in `.superpowers-specs/` (already gitignored)
   - The `docs/` folder is ONLY for published documentation

2. **After moving files into `docs/`, always run `npm run docs:build`**
   - This catches broken links, stray pages, and dead references
   - If build fails, fix before committing

3. **Keep `docs/` structure clean**
   - `docs/index.md` → landing page (only)
   - `docs/guides/migration/` → migration guides
   - `docs/guides/cookbook/` → recipes
   - `docs/guides/architecture/` → ADRs, contributing, plugin authoring
   - `docs/.vitepress/` → config + TypeDoc output
   - No other directories or root-level `.md` files

4. **Verify the rendered pages before pushing**
   - Run: `find docs/.vitepress/dist -name "*.html" | sort`
   - Every `.html` should be a legit doc page, not an AI artifact

## Code Rules

5. **TypeScript strict mode** — no `any` without eslint-disable comment
6. **Zero runtime dependencies** — only devDependencies in package.json
7. **All adapters follow the factory pattern** — see `src/adapters/` for examples
8. **JSDoc on all exported symbols** — TypeDoc generates API docs from these
9. **Tests with Vitest** — run `npx vitest run` before committing
10. **Conventional commits** — `feat:`, `fix:`, `docs:`, `chore:`, `test:`

## Adapter Pattern (How to Add a New Framework)

### Overview
Every adapter exports a factory function that wraps framework-specific request/response objects and feeds data to the shared core utilities.

### Step-by-Step: Adding a New Adapter

#### 1. Create the adapter file
```
src/adapters/myframework.ts
```

#### 2. Import core utilities
```typescript
import type { MiddlewareOptions, DebugEntry } from '../types.js';
import { createTiming } from '../core/timing.js';
import { generateId } from '../core/capture.js';
import { formatEntry } from '../core/formatter.js';
import { sanitizeHeaders } from '../core/sanitize.js';
import { readBodyWithLimit } from '../core/stream.js';  // for Web Streams
import { createDashboardEngine, DASHBOARD_HTML } from '../core/dashboard.js';
```

#### 3. Implement the factory function

The pattern depends on how your framework handles requests:

**A) Middleware pattern (Express, Fastify, Hono)**
```typescript
export function httpDebugger(options: MiddlewareOptions = {}) {
  const maxBodySize = options.maxBodySize ?? 1024;
  const engine = createDashboardEngine(/* ... */);

  return async (req, res, next) => {
    const timing = createTiming();
    const id = generateId();

    timing.markHeadersReceived();

    // 1. Capture request body
    // - For Node streams: wrap req.on('data')
    // - For Web streams: clone req and readBodyWithLimit()

    timing.markBodyComplete();
    timing.markHandlerStart();

    // 2. Call next handler
    await next();

    timing.markHandlerEnd();

    // 3. Capture response body
    // - For Node: wrap res.write/res.end
    // - For Web: clone response and readBodyWithLimit()

    timing.markResponseEnd();

    // 4. Build DebugEntry
    const entry: DebugEntry = {
      id,
      timestamp: Date.now(),
      request: { method, path, headers, body, bodyTruncated, query, params },
      response: { statusCode, headers, body, bodyTruncated, size },
      timing: timing.toJSON(),
      duration: timing.duration,
    };

    // 5. Apply filter
    if (options.filter && !options.filter(entry)) return;

    // 6. Log to console
    console.log(formatEntry(entry, { colors, sanitize, maxDepth, maxArrayItems, curl }));

    // 7. Push to dashboard engine
    if (engine.isEnabled) engine.addEntry(entry);
  };
}
```

**B) HOF pattern (Next.js App Router)**
```typescript
export function withHttpDebugger(
  handler: (req: Request) => Promise<Response>,
  options?: MiddlewareOptions,
) {
  return async (req: Request): Promise<Response> => {
    // Same flow as above, but:
    // - Clone req, read body from ReadableStream
    // - Call handler(req) to get Response
    // - Clone response, read in BACKGROUND (non-blocking)
    // - Return original response immediately
  };
}
```

#### 4. Wire the dashboard (optional)

```typescript
// Inside the middleware, before route handler:
if (engine.isEnabled) {
  if (req.path === '/__debugger') {
    return res.html(DASHBOARD_HTML);
  }
  if (req.path === '/__debugger/stream') {
    // SSE connection
    const teardown = engine.addClientWithHistory(chunk => res.write(chunk));
    req.on('close', teardown);
    return;
  }
}
```

#### 5. Timing marks (REQUIRED ORDER)

```typescript
timing.markHeadersReceived();   // 1. On request receipt
timing.markBodyComplete();      // 2. After request body read
timing.markHandlerStart();      // 3. Before calling next/handler
timing.markHandlerEnd();        // 4. After handler returns
timing.markResponseStart();     // 5. Before reading response body
timing.markResponseEnd();       // 6. After response captured
```

#### 6. Create tests
```
tests/adapters/myframework.test.ts
```

Follow the pattern in `tests/adapters/express.test.ts`:
- Mock `console.log` to capture output
- Create app with middleware
- Make request via real HTTP or framework's test client
- Assert captured output contains method, path, status, body

#### 7. Export in index.ts
```typescript
export { httpDebugger as myframework } from './adapters/myframework.js';
// or for HOF:
export { withHttpDebugger } from './myframework.js';
```

#### 8. Add to build config
```typescript
// tsup.config.ts
entry: [
  'src/index.ts',
  'src/adapters/express.ts',
  'src/adapters/fastify.ts',
  'src/adapters/hono.ts',
  'src/next.ts',
  'src/adapters/myframework.ts',  // <-- add here
],
```

#### 9. Add to package.json exports
```json
"./myframework": {
  "types": "./dist/adapters/myframework.d.ts",
  "import": "./dist/adapters/myframework.js",
  "require": "./dist/adapters/myframework.cjs"
}
```

#### 10. Add peer dependency (if framework has one)
```json
"peerDependencies": {
  "myframework": ">=1.0.0"
},
"peerDependenciesMeta": {
  "myframework": { "optional": true }
}
```

### Existing Adapter Examples

| Adapter | File | Pattern | Key Technique |
|---------|------|---------|---------------|
| Express | `src/adapters/express.ts` | Middleware | Monkey-patch `req.on`, `res.write`, `res.end` |
| Fastify | `src/adapters/fastify.ts` | Plugin | Hooks: `onRequest`, `preHandler`, `onSend` |
| Hono | `src/adapters/hono.ts` | Middleware | Web Streams: `req.clone()`, `res.clone()` |
| Next.js | `src/next.ts` | HOF + catch-all | Non-blocking response clone, `globalThis` singleton |

Study these files to understand framework-specific patterns before implementing yours.