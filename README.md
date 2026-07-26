# http-debugger

Lightweight HTTP debug middleware with terminal UI for Node.js.

Zero dependencies. Captures request/response at the stream level — works with `res.json`, `res.send`, `res.sendStatus`, `res.write`/`res.end`, and streaming.

## Install

```bash
npm install http-debugger
```

## Usage

```typescript
import express from 'express';
import { httpDebugger } from 'http-debugger/express';

const app = express();

// Register FIRST, before body-parser and routes
app.use(httpDebugger());

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

## Why Stream-Level Capture?

Most debug loggers hook into Express methods like `res.json()`. If your app uses `res.send()`, `res.sendStatus()`, or streaming, they miss the body entirely.

http-debugger hooks into Node's `req.on('data')` and `res.write()`/`res.end()` — the underlying streams that ALL response methods use. It captures everything.

## Output

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

## Options

```typescript
httpDebugger({
  filter: (entry) => entry.request.path.startsWith('/api'),  // Only log /api routes
  maxBodySize: 2048,      // Max body bytes to capture (default: 1024)
  sanitize: true,         // Redact Authorization/Cookie headers (default: true)
  colors: true,           // Enable terminal colors (default: auto-detect TTY)
});
```

## License

MIT
