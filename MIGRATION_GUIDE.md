# From Morgan to http-debugger: A Migration Guide

If you're using [Morgan](https://github.com/expressjs/morgan) for HTTP logging in your Express/Fastify/Hono apps, you've probably hit its limitations: no request/response body capture, no cURL generation, no body truncation, and no visual dashboard.

[http-debugger](https://github.com/nacimoualla/http-debugger) is a zero-dependency drop-in replacement that solves all of these — plus adds an embedded real-time dashboard.

---

## Quick Comparison

| Feature | Morgan | http-debugger |
|---------|--------|---------------|
| Request body capture | ❌ | ✅ |
| Response body capture | ❌ | ✅ |
| Body truncation | ❌ | ✅ (configurable) |
| cURL generation | ❌ | ✅ |
| Stream-level capture | ❌ | ✅ |
| Zero runtime deps | ✅ | ✅ |
| TypeScript support | ❌ | ✅ |
| Web dashboard | ❌ | ✅ |
| Frameworks | Express | Express, Fastify, Hono, Next.js |

---

## Migration

### Express

**Before (Morgan):**
```js
const express = require('express');
const morgan = require('morgan');

const app = express();
app.use(morgan('combined'));
app.use(express.json());

app.post('/users', (req, res) => {
  res.json({ created: true });
});
```

**After (http-debugger):**
```typescript
import express from 'express';
import { httpDebugger } from 'http-debugger/express';

const app = express();
app.use(httpDebugger({
  maxBodySize: 1024,      // truncate large bodies
  sanitize: true,         // redact Authorization/Cookie
  colors: true,           // ANSI colors in terminal
  curl: true,             // show cURL for every request
}));
app.use(express.json());

app.post('/users', (req, res) => {
  res.json({ created: true });
});
```

### Output Comparison

**Morgan (`combined`):**
```
::1 - - [28/Jul/2024:10:30:45 +0000] "POST /api/users HTTP/1.1" 201 45 "-" "curl/7.68.0"
```

**http-debugger:**
```
→ POST /api/users
  content-type: application/json
  authorization: ***

  Body: {"name":"Alice","email":"alice@example.com"}

← 201 Created (45ms)
  content-type: application/json
  location: /api/users/123

  Body: {"id":"123","name":"Alice","email":"alice@example.com"}
  Size: 67B

  Timing:
    Headers:   1ms
    Body Read: 2ms
    Handler:   38ms
    Response:  4ms

  curl: curl -X POST 'http://localhost/api/users' -H 'content-type: application/json' -d '{"name":"Alice","email":"alice@example.com"}'
```

---

## Key Differences

| Morgan Token | http-debugger Equivalent |
|--------------|-------------------------|
| `:method` | Auto-captured |
| `:url` | Auto-captured |
| `:status` | Auto-captured |
| `:response-time` | `timing.duration` (sub-ms precision) |
| `:req[header]` | `request.headers` (all headers) |
| `:res[header]` | `response.headers` |
| `:req[body]` | `request.body` (with truncation) |
| `:res[body]` | `response.body` (with truncation) |

---

## Bonus Features You Get Free

### 1. **Embedded Dashboard**
```typescript
app.use(httpDebugger({ dashboard: true }));
```
Visit `http://localhost:3000/__debugger` for a real-time dashboard with filters, HAR export, and pause/clear controls.

### 2. **Smart Truncation**
```typescript
httpDebugger({ maxBodySize: 2048 }); // truncate at 2KB, stream continues unmodified
```

### 3. **cURL for Every Request**
```typescript
httpDebugger({ 
  curl: (entry) => entry.response.statusCode >= 400 // only on errors
});
```

### 4. **Works Everywhere**
```typescript
// Fastify
import { httpDebugger } from 'http-debugger/fastify';
fastify.register(httpDebugger());

// Hono
import { httpDebugger } from 'http-debugger/hono';
app.use('*', httpDebugger());

// Next.js App Router
import { withHttpDebugger } from 'http-debugger/next';
export const GET = withHttpDebugger(handler);
```

---

## Why Switch?

1. **Debug faster** — See request/response bodies instantly, no more `console.log(req.body)`
2. **Reproduce instantly** — Copy the generated cURL, paste in terminal, done
3. **Catch bugs in production** — Dashboard works in development, auto-disabled in production
4. **Zero cost** — Zero runtime dependencies, zero performance impact on your app

---

## Try It

```bash
npm install http-debugger
```

Then replace your Morgan import with:
```typescript
import { httpDebugger } from 'http-debugger/express';
app.use(httpDebugger());
```

That's it. Your terminal output just became 10x more useful.

---

*Have questions? [Open an issue](https://github.com/nacimoualla/http-debugger/issues) or check the [docs](https://nacimoualla.github.io/http-debugger/).*