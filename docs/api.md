# API Reference

## Types

### `MiddlewareOptions`

Configuration options for the middleware.

```typescript
interface MiddlewareOptions {
  filter?: (entry: DebugEntry) => boolean;
  maxBodySize?: number;      // default: 1024
  maxDepth?: number;         // default: 4
  maxArrayItems?: number;    // default: 10
  sanitize?: boolean;        // default: true
  colors?: boolean;          // auto-detect TTY
  curl?: boolean | ((entry: DebugEntry) => boolean);
}
```

### `DebugEntry`

Complete debug entry for a single HTTP request/response cycle.

```typescript
interface DebugEntry {
  id: string;                // UUID
  timestamp: number;         // Date.now()
  request: RequestCapture;
  response: ResponseCapture;
  timing: TimingInfo;
  duration: number;          // total ms
}
```

### `RequestCapture`

```typescript
interface RequestCapture {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  bodyTruncated: boolean;
  query: Record<string, string>;
  params: Record<string, string>;
}
```

### `ResponseCapture`

```typescript
interface ResponseCapture {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  bodyTruncated: boolean;
  size: number;              // bytes
}
```

### `TimingInfo`

All values in milliseconds, relative to request start.

```typescript
interface TimingInfo {
  headersReceived: number;
  bodyComplete: number;
  handlerStart: number;
  handlerEnd: number;
  responseStart: number;
  responseEnd: number;
}
```

### `CaptureResult`

Returned by `captureRequestBody` and `captureResponseBody`.

```typescript
interface CaptureResult {
  body: unknown;
  truncated: boolean;
}
```

---

## Core Functions

### `createTiming()`

Creates a high-resolution timer using `performance.now()`.

```typescript
import { createTiming } from 'http-debugger';

const timing = createTiming();
timing.markHeadersReceived();
// ... later
timing.markResponseEnd();
console.log(timing.toJSON()); // TimingInfo
console.log(timing.duration); // total ms
```

### `generateId()`

Generates a UUID for request identification.

```typescript
import { generateId } from 'http-debugger';

const id = generateId(); // "550e8400-e29b-41d4-a716-446655440000"
```

### `captureRequestBody(chunks, contentType, maxBodySize?)`

Captures and parses a request body from raw stream chunks.

```typescript
import { captureRequestBody } from 'http-debugger';

const result = captureRequestBody(chunks, 'application/json', 2048);
// result.body → parsed JSON or string
// result.truncated → true if exceeded maxBodySize
```

### `captureResponseBody(chunks, maxBodySize?)`

Captures and parses a response body from raw stream chunks.

```typescript
import { captureResponseBody } from 'http-debugger';

const result = captureResponseBody(chunks, 2048);
// result.body → parsed JSON or string
// result.truncated → true if exceeded maxBodySize
```

### `formatEntry(entry, options?)`

Formats a debug entry into a human-readable terminal string.

```typescript
import { formatEntry } from 'http-debugger';

const output = formatEntry(entry, {
  colors: true,
  sanitize: true,
  maxDepth: 4,
  maxArrayItems: 10,
  curl: true,
});
console.log(output);
```

### `sanitizeHeaders(headers, enabled?)`

Redacts sensitive headers (Authorization, Cookie, etc.).

```typescript
import { sanitizeHeaders } from 'http-debugger';

const sanitized = sanitizeHeaders({
  authorization: 'Bearer secret123',
  'content-type': 'application/json',
});
// { authorization: "***", "content-type": "application/json" }
```

---

## Adapters

### Express

```typescript
import { httpDebugger } from 'http-debugger/express';

app.use(httpDebugger(options?));
```

**How it works**: Wraps `req.on('data')`/`req.on('end')` for request body capture, wraps `res.write()`/`res.end()` for response body capture. Logs on `res.on('finish')`.

**Compatibility**: `res.json()`, `res.send()`, `res.sendStatus()`, `res.write()`/`res.end()`, `res.sendFile()`, streaming responses.

### Fastify

```typescript
import { httpDebugger } from 'http-debugger/fastify';

fastify.register(httpDebugger(options?));
```

**How it works**: Uses `onRequest` hook (timing + ID), `preHandler` hook (body complete), `onSend` hook (response capture + logging).

**Note**: Registers without encapsulation via `Symbol.for('skip-override')`.

### Hono

```typescript
import { httpDebugger } from 'http-debugger/hono';

app.use('*', httpDebugger(options?));
```

**How it works**: Clones `Request`/`Response` streams, reads with `ReadableStream.getReader()`, uses `Uint8Array` concat (no `Buffer`).

**Runtime**: Node.js, Deno, Bun, Cloudflare Workers (WinterCG compatible).
