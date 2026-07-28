# Migrating from Morgan to http-debugger

Side-by-side comparison and migration guide for Express users.

## Quick Comparison

| Feature | Morgan | http-debugger |
|---------|--------|---------------|
| Request body capture | ❌ | ✅ |
| Response body capture | ❌ | ✅ |
| Body truncation | ❌ | ✅ (configurable) |
| cURL generation | ❌ | ✅ |
| Stream-level capture | ❌ | ✅ |
| Zero runtime deps | ✅ | ✅ |
| TypeScript support | ⚠️ (types separate) | ✅ (built-in) |
| Fastify/Hono/Next.js | ❌ | ✅ |
| Web dashboard | ❌ | ✅ |

## Express Migration

### Before (Morgan)

```js
const express = require('express')
const morgan = require('morgan')

const app = express()
app.use(morgan('combined'))
// or custom:
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'))
```

### After (http-debugger)

```ts
import express from 'express'
import { httpDebugger } from 'http-debugger/express'

const app = express()
app.use(httpDebugger())
```

## Configuration Mapping

| Morgan Format Token | http-debugger Equivalent |
|---------------------|-------------------------|
| `:method` | Auto-captured |
| `:url` | Auto-captured (full path + query) |
| `:status` | Auto-captured |
| `:res[content-length]` | `response.size` |
| `:response-time` | `timing.duration` |
| `:req[header]` | `request.headers` |
| `:res[header]` | `response.headers` |
| `:req[body]` | `request.body` (with truncation) |
| `:res[body]` | `response.body` (with truncation) |

## Custom Token → Filter/Options

### Morgan Custom Token
```js
morgan.token('user-id', (req) => req.user?.id ?? 'anonymous')
app.use(morgan(':method :url :status :user-id'))
```

### http-debugger Equivalent
```ts
app.use(httpDebugger({
  filter: (entry) => {
    // Access user from request context
    return true // log all, or filter as needed
  }
}))
// User info available in: entry.request.headers['x-user-id'] (if you set it)
```

## Output Comparison

### Morgan (combined)
```
::1 - - [28/Jul/2024:10:30:45 +0000] "POST /api/users HTTP/1.1" 201 45 "-" "curl/7.68.0"
```

### http-debugger (default)
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
    Headers:   1.2ms
    Body Read: 2.1ms
    Handler:   38.5ms
    Response:  3.2ms

  curl: curl -X POST 'http://localhost/api/users' -H 'content-type: application/json' -d '{"name":"Alice","email":"alice@example.com"}'
```

## Advanced Migration

### Conditional Logging

**Morgan:**
```js
app.use(morgan('combined', {
  skip: (req, res) => res.statusCode < 400
}))
```

**http-debugger:**
```ts
app.use(httpDebugger({
  filter: (entry) => entry.response.statusCode >= 400
}))
```

### Custom Output Stream

**Morgan:**
```js
const fs = require('fs')
const accessLogStream = fs.createWriteStream('access.log', { flags: 'a' })
app.use(morgan('combined', { stream: accessLogStream }))
```

**http-debugger:**
```ts
import { httpDebugger } from 'http-debugger/express'
import { formatEntry } from 'http-debugger'
import fs from 'fs'

const logStream = fs.createWriteStream('access.log', { flags: 'a' })

app.use(httpDebugger({
  // Custom console: false, // We'll handle output
 filter: (entry) => {
   logStream.write(formatEntry(entry) + '\n\n')
   return false // Don't double-log to console
 }
}))
```

### Request ID Correlation

**Morgan:**
```js
app.use((req, res, next) => {
  req.id = crypto.randomUUID()
  res.setHeader('X-Request-ID', req.id)
  next()
})
app.use(morgan(':id :method :url :status'))
```

**http-debugger:**
```ts
import { v4 as uuidv4 } from 'uuid'

app.use((req, res, next) => {
  req.id = uuidv4()
  res.setHeader('X-Request-ID', req.id)
  next()
})

app.use(httpDebugger({
  // Request ID auto-captured in headers
}))
// Available in: entry.request.headers['x-request-id']
```

## Dashboard Bonus

Morgan has no equivalent. With http-debugger:

```ts
app.use(httpDebugger({ dashboard: true }))
```

Visit `http://localhost:3000/__debugger` for real-time request inspection.

## Checklist

- [ ] Replace `morgan()` with `httpDebugger()`
- [ ] Remove custom token definitions (built-in capture is richer)
- [ ] Update custom format strings → use `filter` option
- [ ] Test body capture with JSON/form-data requests
- [ ] Enable `dashboard: true` for development
- [ ] Set `maxBodySize` appropriate for your payloads
- [ ] Verify `sanitize: true` redacts sensitive headers
- [ ] Check cURL output for failed requests