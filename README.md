# http-debugger

[![npm version](https://img.shields.io/npm/v/http-debugger.svg)](https://www.npmjs.com/package/http-debugger)
[![CI](https://github.com/nacimoualla/http-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/nacimoualla/http-debugger/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/http-debugger.svg)](./LICENSE)
[![Downloads](https://img.shields.io/npm/dm/http-debugger.svg)](https://www.npmjs.com/package/http-debugger)
[![Docs](https://img.shields.io/badge/docs-live-brightgreen)](https://nacimoualla.github.io/http-debugger/)

**Zero-dependency HTTP debug middleware for Node.js, Deno, Bun, and the Edge.**

Stop writing `console.log(req.body)` and stop switching to Postman to replay failed requests. `http-debugger` intercepts raw HTTP streams to give you safe, readable, and actionable terminal observability.

## The Output

```text
→ POST /api/users
  content-type: application/json
  authorization: ***

  Body: {
    "name": "Alice",
    "roles": ["admin", ... 2 more]
  }

← 500 Internal Server Error (45ms)
  content-type: application/json

  Body: { "error": "Database connection failed" }
  Size: 45B

  Timing:
    Headers:   1ms
    Body Read: 2ms
    Handler:   38ms
    Response:  4ms

  curl: curl -X POST 'http://localhost:3000/api/users' \
    -H 'content-type: application/json' \
    -d '{"name":"Alice"}'
```

## Core Features

* **Instant Replay:** Automatically generates ready-to-paste cURL commands for failed requests.
* **No Terminal Spam:** Smart body truncation collapses deep JSON objects and massive arrays so your terminal stays readable.
* **Zero Dependencies:** A tiny footprint that won't bloat your `node_modules`.
* **Framework Native:** Ships with optimized adapters for Express, Fastify, Hono, and Next.js.
* **Edge Ready:** The Hono adapter relies strictly on WinterCG standard Web APIs (`performance.now()`, `ReadableStream`), making it fully compatible with Cloudflare Workers, Deno, and Bun.

## Installation

```bash
npm install http-debugger
```

## Quick Start

Pick your framework. Register the middleware **before** your routes.

### Express

```typescript
import express from 'express';
import { httpDebugger } from 'http-debugger/express';

const app = express();
app.use(httpDebugger());
```

### Fastify

```typescript
import Fastify from 'fastify';
import { httpDebugger } from 'http-debugger/fastify';

const fastify = Fastify();
fastify.register(httpDebugger());
```

### Hono

```typescript
import { Hono } from 'hono';
import { httpDebugger } from 'http-debugger/hono';

const app = new Hono();
app.use('*', httpDebugger());
```
### Astro

```typescript
// src/middleware.ts
import { httpDebugger } from 'http-debugger/astro';

export const onRequest = httpDebugger();

```markdown
### Elysia (Bun)

```typescript
import { Elysia } from 'elysia';
import { httpDebugger } from 'http-debugger/elysia';

const app = new Elysia()
  .use(httpDebugger())
  .get('/', () => ({ hello: 'world' }))
  .listen(3000);

```markdown
### Next.js (App Router)

```typescript
// app/api/users/route.ts
import { withHttpDebugger } from 'http-debugger/next';

async function handler(req: Request) {
  return Response.json({ users: [] });
}

export const GET = withHttpDebugger(handler);
```

Mount the dashboard:

```typescript
// app/__debugger/[[...route]]/route.ts
import { dashboardRoute } from 'http-debugger/next';

export const GET = dashboardRoute({ maxDepth: 4, sanitize: true });
```

## Embedded Dashboard

http-debugger includes a real-time web dashboard accessible at `/__debugger` when enabled.

```typescript
app.use(httpDebugger({ dashboard: true }));
```

**Features:**
- **Live stream** — Real-time updates via SSE, no refresh needed
- **Filters** — Method, status, duration (`>500ms`), size (`<10KB`), date range
- **Pause/Resume** — Freeze the list without disconnecting SSE
- **Replay** — Re-send any request with one click, see the new response inline
- **HAR Export** — Full (Chrome DevTools compatible) or Minimal
- **Clear** — Instant buffer reset
- **Auto-disabled in production** (`NODE_ENV=production`)

Visit `http://localhost:3000/__debugger` to access the dashboard.

## Configuration

Pass an options object to customize the behavior.

```typescript
httpDebugger({
  // Show cURL command only when a request fails
  curl: (entry) => entry.response.statusCode >= 400,

  // Memory protection: max raw bytes to capture before dropping (default: 1024)
  maxBodySize: 2048,

  // Visual limits: collapse JSON deeper than 4 levels
  maxDepth: 4,

  // Visual limits: show only first 10 items of an array
  maxArrayItems: 10,

  // Automatically redact Authorization and Cookie headers
  sanitize: true,

  // Filter out noise (e.g., ignore health checks)
  filter: (entry) => !entry.request.path.includes('/health')
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filter` | `(entry: DebugEntry) => boolean` | — | Only log entries that pass this check |
| `maxBodySize` | `number` | `1024` | Max bytes to capture per body. Larger bodies are truncated. |
| `maxDepth` | `number` | `4` | Max nesting depth before collapsing JSON objects. |
| `maxArrayItems` | `number` | `10` | Max array items to show before truncating. |
| `curl` | `boolean \| ((entry: DebugEntry) => boolean)` | `false` | Show cURL command. Pass a function for conditional output. |
| `sanitize` | `boolean` | `true` | Redact sensitive headers (`Authorization`, `Cookie`, etc.) |
| `colors` | `boolean` | auto | Enable/disable ANSI color output. Auto-detects TTY. |

## How It Works

1. The middleware wraps `req.on()` to intercept `data` and `end` events, collecting raw request body chunks.
2. It wraps `res.write()` and `res.end()` to intercept response body chunks.
3. A safety valve stops collecting once `maxBodySize` is reached — the stream continues flowing unmodified, so large responses (files, video, downloads) never cause memory issues.
4. On response `finish`, it builds a `DebugEntry` with request, response, and timing data, then formats and logs it.

## Why not Morgan / Pino?

| Feature | http-debugger | Morgan | Pino |
|---------|:---:|:---:|:---:|
| Stream-level capture | ✅ | ❌ | ❌ |
| Request body capture | ✅ | ❌ | ❌ |
| Response body capture | ✅ | ❌ | ❌ |
| Body truncation | ✅ | ❌ | ❌ |
| cURL generation | ✅ | ❌ | ❌ |
| Zero runtime deps | ✅ | ✅ | ❌ |
| TypeScript support | ✅ | ❌ | ✅ |
| Express | ✅ | ✅ | ✅ |
| Fastify | ✅ | ❌ | ✅ |
| Hono / Edge | ✅ | ❌ | ❌ |
| Next.js (App Router) | ✅ | ❌ | ❌ |

**Morgan** is great for access logs in production, but it doesn't capture request/response bodies and has no truncation or cURL output.

**Pino** is a high-performance structured logger, but it's a different use case — it requires manual instrumentation and doesn't intercept streams automatically.

## Contributing

Contributions welcome! See the [contributing guide](docs/guides/architecture/contributing.md) for setup, code style, and how to add a new adapter.

Quick start:

```bash
git clone https://github.com/nacimoualla/http-debugger.git
cd http-debugger
npm install
npm test
```

## Exports

```typescript
// Core
export { createTiming } from 'http-debugger';
export { generateId, captureRequestBody, captureResponseBody } from 'http-debugger';
export { formatEntry } from 'http-debugger';
export { sanitizeHeaders } from 'http-debugger';
export { createDashboardEngine, DASHBOARD_HTML } from 'http-debugger';
export type { DebugEntry, TimingInfo, MiddlewareOptions, CaptureResult, DashboardOptions } from 'http-debugger';

// Adapters
import { httpDebugger } from 'http-debugger/express';
import { httpDebugger } from 'http-debugger/fastify';
import { httpDebugger } from 'http-debugger/hono';

// Next.js
import { withHttpDebugger, dashboardRoute } from 'http-debugger/next';
```

## License

**MIT License with No-Resale Clause**

This project is completely free to use internally to build, develop, test, and maintain commercial or personal products. However, you may **not** sell, lease, or sublicense this software itself (or a modified version of it) as a standalone commercial product. See the [LICENSE](./LICENSE) file for full details.
