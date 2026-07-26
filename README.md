# http-debugger

Lightweight HTTP debug middleware for Node.js with a clean terminal UI.

Captures request and response data at the **stream level** — not at the Express API level. This means it works with every response method your app uses: `res.json()`, `res.send()`, `res.sendStatus()`, `res.write()`/`res.end()`, and streaming.

**Zero runtime dependencies.** Built with TypeScript. Ships ESM + CJS.

## Install

```bash
npm install http-debugger
```

## Quick Start

```typescript
import express from 'express';
import { httpDebugger } from 'http-debugger/express';

const app = express();

app.use(httpDebugger());

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

Register `httpDebugger()` **before** `express.json()` and your route handlers. This lets it intercept the raw request body stream before body-parser consumes it.

## Output

Every request logs a structured block to your terminal:

```
→ POST /api/users
  Headers: { "content-type": "application/json", "authorization": "***" }
  Body: {
    "name": "Alice"
  }

← 201 Created (45ms)
  Headers: { "content-type": "application/json" }
  Body: {
    "id": 1,
    "name": "Alice"
  }
  Size: 67B

  Timing:
    Headers:  2ms
    Body:     1ms
    Handler:  38ms
    Response: 4ms
```

Sensitive headers (`Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`) are redacted by default.

## Why Stream-Level Capture?

Most debug loggers monkey-patch Express methods like `res.json()`. If your code uses `res.send()`, `res.sendStatus()`, or streams, the body is never captured.

http-debugger hooks into the underlying Node.js streams — `req.on('data')` and `res.write()`/`res.end()` — which **all** Express response methods use internally.

| Response Method | API-level logger | http-debugger |
|-----------------|------------------|---------------|
| `res.json(obj)` | Captures | Captures |
| `res.send(str)` | Misses | Captures |
| `res.sendStatus(200)` | Misses | Captures |
| `res.write()` + `res.end()` | Misses | Captures |
| `res.sendFile(path)` | Misses | Captures |
| Streaming response | Misses | Captures |

## Options

```typescript
httpDebugger({
  filter: (entry) => entry.request.path.startsWith('/api'),
  maxBodySize: 2048,
  sanitize: true,
  colors: true,
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filter` | `(entry: DebugEntry) => boolean` | — | Only log entries that pass this check |
| `maxBodySize` | `number` | `1024` | Max bytes to capture per body. Larger bodies are truncated. |
| `sanitize` | `boolean` | `true` | Redact sensitive headers |
| `colors` | `boolean` | auto | Enable/disable ANSI color output. Auto-detects TTY. |

## How It Works

1. The middleware wraps `req.on()` to intercept `data` and `end` events, collecting raw request body chunks.
2. It wraps `res.write()` and `res.end()` to intercept response body chunks.
3. A safety valve stops collecting once `maxBodySize` is reached — the stream continues flowing unmodified, so large responses (files, video, downloads) never cause memory issues.
4. On response `finish`, it builds a `DebugEntry` with request, response, and timing data, then formats and logs it.

## License

MIT — for personal and internal use only. No distribution, sublicensing, or selling permitted.
