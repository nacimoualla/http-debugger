# Plugin Authoring Guide

Create custom framework adapters for http-debugger.

## Adapter Interface

Every adapter exports a factory function:

```ts
// src/adapters/myframework.ts
import type { MiddlewareOptions } from '../types.js'
import { createTiming } from '../core/timing.js'
import { generateId } from '../core/capture.js'
import { formatEntry } from '../core/formatter.js'

export function httpDebugger(options: MiddlewareOptions = {}) {
  // Return framework-specific middleware/handler
}
```

## Required Exports

```ts
// src/index.ts
export { httpDebugger as myframework } from './adapters/myframework.js'
export type { MyFrameworkMiddleware } from './adapters/myframework.js'
```

## Core Utilities

| Utility | Import | Purpose |
|---------|--------|---------|
| `createTiming()` | `../core/timing.js` | High-res timer with marks |
| `generateId()` | `../core/capture.js` | Unique request ID |
| `captureRequestBody()` | `../core/capture.js` | Parse request body from chunks |
| `captureResponseBody()` | `../core/capture.js` | Parse response body from chunks |
| `readBodyWithLimit()` | `../core/stream.js` | Read Web Stream with byte limit |
| `formatEntry()` | `../core/formatter.js` | Terminal output formatter |
| `sanitizeHeaders()` | `../core/sanitize.js` | Redact sensitive headers |

## Adapter Patterns

### Express (Monkey-Patch Streams)

```ts
export function httpDebugger(options: MiddlewareOptions = {}): RequestHandler {
  return (req, res, next) => {
    const timing = createTiming()
    const id = generateId()

    // Intercept req.on('data') / req.on('end')
    // Intercept res.write / res.end
    // On res.on('finish'): capture, format, log

    next()
  }
}
```

### Fastify (Hooks)

```ts
import type { FastifyPluginAsync } from 'fastify'

export const httpDebugger: FastifyPluginAsync<MiddlewareOptions> = async (fastify, options) => {
  fastify.addHook('onRequest', async (request) => {
    request.httpDebuggerTiming = createTiming()
    request.httpDebuggerId = generateId()
    timing.markHeadersReceived()
  })

  fastify.addHook('preHandler', async (request) => {
    request.httpDebuggerTiming.markBodyComplete()
  })

  fastify.addHook('onSend', async (request, reply, payload) => {
    // Capture response from payload
    // Format and log
  })
}

;(httpDebugger as any)[Symbol.for('skip-override')] = true
```

### Hono (Web Streams)

```ts
export function httpDebugger(options: MiddlewareOptions = {}): MiddlewareHandler {
  return async (c, next) => {
    const timing = createTiming()
    const id = generateId()

    timing.markHeadersReceived()

    // Clone request, read body from stream
    const reqClone = c.req.raw.clone()
    const { body: reqBodyStr, truncated: reqTruncated } = await readBodyWithLimit(
      reqClone.body,
      options.maxBodySize ?? 1024
    )

    await next()

    timing.markHandlerEnd()
    timing.markResponseStart()

    // Clone response, read body
    const resClone = c.res.clone()
    const { body: resBodyStr, truncated: resTruncated } = await readBodyWithLimit(
      resClone.body,
      options.maxBodySize ?? 1024
    )

    timing.markResponseEnd()
    // Build entry, format, log
  }
}
```

### Next.js (HOF Wrapper)

```ts
export function withHttpDebugger(
  handler: (req: Request) => Promise<Response> | Response,
  handlerOptions?: MiddlewareOptions
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const timing = createTiming()
    const id = generateId()

    // Capture request body
    const reqClone = req.clone()
    const { body: reqBodyStr, truncated: reqTruncated } = await readBodyWithLimit(
      reqClone.body,
      handlerOptions?.maxBodySize ?? 1024
    )

    timing.markHeadersReceived()
    timing.markBodyComplete()
    timing.markHandlerStart()

    const res = await handler(req)

    timing.markHandlerEnd()
    timing.markResponseStart()

    // Non-blocking response capture
    const resClone = res.clone()
    ;(async () => {
      const { body: resBodyStr, truncated: resTruncated } = await readBodyWithLimit(
        resClone.body,
        handlerOptions?.maxBodySize ?? 1024
      )
      timing.markResponseEnd()
      // Build entry, log
    })().catch(() => {})

    return res
  }
}
```

## Timing Marks (Required Order)

```ts
timing.markHeadersReceived()   // 1. Immediately on request receipt
timing.markBodyComplete()      // 2. After request body fully read
timing.markHandlerStart()      // 3. Before calling next/handler
timing.markHandlerEnd()        // 4. After handler returns
timing.markResponseStart()     // 5. Before reading response body
timing.markResponseEnd()       // 6. After response body captured
```

## Entry Construction

```ts
const entry = {
  id,
  timestamp: Date.now(),
  request: {
    method: req.method,
    path: req.url, // or req.path
    headers: sanitizeHeaders(req.headers, options.sanitize),
    body: reqTruncated ? null : parsedBody,
    bodyTruncated: reqTruncated,
    query: parsedQuery,
    params: routeParams
  },
  response: {
    statusCode: res.statusCode,
    headers: sanitizeHeaders(res.headers, options.sanitize),
    body: resTruncated ? null : parsedBody,
    bodyTruncated: resTruncated,
    size: byteLength
  },
  timing: timing.toJSON(),
  duration: timing.duration
}
```

## Filter & Options

```ts
// Apply filter
if (options.filter && !options.filter(entry)) return

// Format with options
const output = formatEntry(entry, {
  colors: options.colors,
  sanitize: options.sanitize,
  maxDepth: options.maxDepth,
  maxArrayItems: options.maxArrayItems,
  curl: options.curl
})

console.log(output)
```

## Dashboard Integration (Optional)

```ts
import { engine } from '../core/singleton.js'

// In your adapter, after building entry:
if (engine.isEnabled) {
  engine.addEntry(entry as any)
}
```

For Next.js, use the singleton pattern in `src/core/singleton.ts`.

## Testing Your Adapter

```ts
// tests/adapters/myframework.test.ts
import { describe, it, expect, vi } from 'vitest'
import { httpDebugger } from '../../src/adapters/myframework.js'

describe('httpDebugger MyFramework adapter', () => {
  it('captures request and response', async () => {
    const captured: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => captured.push(args.join(' ')))

    // Create app with middleware
    // Make request
    // Assert captured output contains method, path, status
  })

  it('truncates large bodies', async () => {
    // Test maxBodySize behavior
  })

  it('sanitizes Authorization header', async () => {
    // Test sanitize: true
  })

  it('generates cURL when enabled', async () => {
    // Test curl: true
  })
})
```

## Checklist for New Adapters

- [ ] Implements framework's middleware/handler interface
- [ ] Captures request body (stream-level)
- [ ] Captures response body (stream-level)
- [ ] Records all 6 timing marks in order
- [ ] Applies `sanitizeHeaders` with `options.sanitize`
- [ ] Respects `options.filter`
- [ ] Supports `options.curl` (boolean or function)
- [ ] Supports `options.maxDepth`, `maxArrayItems`, `colors`
- [ ] Truncates at `options.maxBodySize` (default 1024)
- [ ] Adds `bodyTruncated` flags
- [ ] Unit tests for all features
- [ ] Exported in `src/index.ts`
- [ ] Added to `tsup.config.ts` entry points
- [ ] Documented in `/docs/guides/architecture/plugin-authoring.md`