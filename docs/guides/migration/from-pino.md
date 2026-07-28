---
title: Migrating from Pino
---

# Migrating from Pino to http-debugger

## Quick Comparison

| Feature | Pino | http-debugger |
|---------|------|---------------|
| Stream-level capture | ❌ | ✅ |
| Request body capture | ❌ (manual) | ✅ |
| Response body capture | ❌ (manual) | ✅ |
| Body truncation | ❌ | ✅ |
| cURL generation | ❌ | ✅ |
| Zero runtime deps | ❌ | ✅ |
| TypeScript support | ✅ | ✅ |
| Express | ✅ (via pino-http) | ✅ |
| Fastify | ✅ (native) | ✅ |
| Hono / Edge | ❌ | ✅ |
| Next.js (App Router) | ❌ | ✅ |

> **Note:** Pino is a structured logger. http-debugger is an HTTP request/response debugger. They serve different purposes — you can use both together.

## Express Example

### Before (pino-http)

```ts
import express from 'express'
import pino from 'pino'
import pinoHttp from 'pino-http'

const logger = pino({ level: 'info' })
const app = express()

app.use(pinoHttp({ logger }))
app.use(express.json())

app.post('/users', (req, res) => {
  logger.info({ user: req.body }, 'User created')
  res.json({ created: true })
})
```

### After (http-debugger)

```ts
import express from 'express'
import { httpDebugger } from 'http-debugger/express'

const app = express()
app.use(httpDebugger({
  maxBodySize: 1024,
  sanitize: true,
  colors: true,
  curl: (entry) => entry.response.statusCode >= 400
}))
app.use(express.json())

app.post('/users', (req, res) => {
  res.json({ created: true })
})
```

## Fastify Example

### Before (Pino native)

```ts
import Fastify from 'fastify'

const fastify = Fastify({ logger: true })

fastify.post('/users', async (request, reply) => {
  fastify.log.info({ user: request.body }, 'User created')
  return { created: true }
})
```

### After (http-debugger)

```ts
import Fastify from 'fastify'
import { httpDebugger } from 'http-debugger/fastify'

const fastify = Fastify()
fastify.register(httpDebugger, {
  maxBodySize: 1024,
  sanitize: true,
  curl: true
})

fastify.post('/users', async (request, reply) => {
  return { created: true }
})
```

## Configuration Mapping

| Pino Option | http-debugger Option |
|-------------|---------------------|
| `logger.level` | N/A (http-debugger logs to console) |
| `redact.paths` | `sanitize: true` (auto-redacts Auth, Cookie) |
| `serializers` | N/A (structured entry object) |
| `customLogLevel` | `filter: (entry) => ...` |
| `quietReqLogger` | `filter: (entry) => false` |

## Output Comparison

### Pino (structured JSON)
```json
{
  "level": 30,
  "time": 1722162645123,
  "pid": 12345,
  "hostname": "host",
  "req": {
    "method": "POST",
    "url": "/api/users",
    "headers": { "content-type": "application/json" }
  },
  "res": { "statusCode": 201 },
  "msg": "request completed"
}
```

### http-debugger (human-readable terminal)
```
→ POST /api/users
  content-type: application/json
  authorization: ***
  Body: {"name":"Alice"}

← 201 Created (15ms)
  content-type: application/json
  Body: {"created":true}
  Size: 18B

  Timing:
    Headers:   0.8ms
    Body Read: 0.3ms
    Handler:   9.2ms
    Response:  4.7ms

  curl: curl -X POST 'http://localhost/api/users' -H 'content-type: application/json' -H 'authorization: ***' -d '{"name":"Alice"}'
```

## Using Both Together

Since they serve different purposes, you can use both:

```ts
import express from 'express'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { httpDebugger } from 'http-debugger/express'

const logger = pino({ level: 'info' })
const app = express()

// Structured logging for your application
app.use(pinoHttp({ logger }))

// HTTP debugging for development
if (process.env.NODE_ENV !== 'production') {
  app.use(httpDebugger({ maxBodySize: 2048, curl: true }))
}

app.use(express.json())
app.post('/users', (req, res) => {
  logger.info({ user: req.body }, 'User created')  // App log
  res.json({ created: true })  // http-debugger captures this automatically
})
```

## Key Differences

1. **Purpose** — Pino logs structured events for production observability. http-debugger captures full HTTP context for development debugging.

2. **Body capture** — Pino requires manual `req.body` logging. http-debugger intercepts streams automatically.

3. **cURL generation** — Unique to http-debugger; essential for reproducing issues.

4. **Truncation** — http-debugger protects memory with configurable limits; Pino logs everything by default.

5. **Production use** — Pino is production-ready. http-debugger has a production guard (`NODE_ENV=production` disables dashboard).