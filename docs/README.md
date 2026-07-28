# http-debugger

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

## What's in here

| Module | Description |
|--------|-------------|
| `src/adapters/express.ts` | Express middleware — stream-level `req.on('data')` and `res.write()`/`res.end()` interception |
| `src/adapters/fastify.ts` | Fastify plugin — idiomatic `onRequest`/`preHandler`/`onSend` hooks |
| `src/adapters/hono.ts` | Hono middleware — runtime-agnostic `ReadableStream.getReader()` body capture |
| `src/core/timing.ts` | High-resolution `performance.now()` timer for 6 lifecycle phases |
| `src/core/capture.ts` | Body capture with `maxBodySize` safety valve and JSON auto-parsing |
| `src/core/formatter.ts` | Terminal output formatting, `maxDepth`/`maxArrayItems` truncation, cURL generation |
| `src/core/sanitize.ts` | Header redaction for `Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization` |
| `src/types.ts` | TypeScript interfaces for all public APIs |

## Installation

```bash
npm install http-debugger
```

## Quick Start

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

## Configuration

```typescript
httpDebugger({
  curl: (entry) => entry.response.statusCode >= 400,
  maxBodySize: 2048,
  maxDepth: 4,
  maxArrayItems: 10,
  sanitize: true,
  filter: (entry) => !entry.request.path.includes('/health')
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filter` | `(entry) => boolean` | — | Only log entries that pass this check |
| `maxBodySize` | `number` | `1024` | Max bytes to capture per body before truncating |
| `maxDepth` | `number` | `4` | Max JSON nesting depth before collapsing objects |
| `maxArrayItems` | `number` | `10` | Max array items to show before truncating |
| `curl` | `boolean \| (entry) => boolean` | `false` | Show cURL command (always or conditionally) |
| `sanitize` | `boolean` | `true` | Redact sensitive headers |
| `colors` | `boolean` | auto | Enable/disable ANSI color output |

## Architecture

```
src/
├── adapters/
│   ├── express.ts    ← Stream-level interception (req.on, res.write, res.end)
│   ├── fastify.ts    ← Hook-based (onRequest, preHandler, onSend)
│   └── hono.ts       ← Web Standard ReadableStream with byte counting
├── core/
│   ├── timing.ts     ← performance.now() high-resolution timer
│   ├── capture.ts    ← Buffer collection with safety valve
│   ├── formatter.ts  ← Terminal output, depth truncation, cURL gen
│   └── sanitize.ts   ← Header redaction
├── index.ts          ← Public API exports
└── types.ts          ← TypeScript interfaces
```

### How it works

1. **Express**: Wraps `req.on()` to intercept `data`/`end` events, wraps `res.write()`/`res.end()` to capture response chunks. A safety valve stops collecting at `maxBodySize` — the stream continues flowing unmodified.
2. **Fastify**: Uses `onRequest` to start timing, `preHandler` to mark body read, `onSend` to capture the serialized response payload.
3. **Hono**: Clones `Request`/`Response` streams and reads them with `ReadableStream.getReader()`. Uses `Uint8Array` concat (no `Buffer`) for runtime portability.

### Body truncation

All adapters enforce a `maxBodySize` limit (default 1024 bytes). When exceeded:
- The body is not stored (saves memory)
- `bodyTruncated: true` is set on the debug entry
- The formatter shows `[truncated]` instead of the body
- The cURL command adds a warning comment instead of `-d`

### Timing phases

| Phase | What it measures |
|-------|-----------------|
| Headers | Time from request start to headers received |
| Body Read | Time from headers received to body fully read |
| Handler | Time from handler start to handler end |
| Response | Time from response start to response fully sent |

## License

MIT — for personal and internal use only. No distribution, sublicensing, or selling permitted.
