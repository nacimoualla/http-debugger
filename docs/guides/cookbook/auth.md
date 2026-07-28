# Recipe: Authentication (JWT, Sessions, Cookies)

Capture auth headers and cookies safely with automatic sanitization.

## JWT Bearer Tokens

```ts
import { httpDebugger } from 'http-debugger/express'

app.use(httpDebugger({
  sanitize: true,  // Redacts Authorization header automatically
  maxBodySize: 2048
}))

app.post('/api/protected', (req, res) => {
  const auth = req.headers.authorization // 'Bearer eyJhbGciOiJIUzI1NiIs...'
  // http-debugger captures: 'authorization: ***'
})
```

**Dashboard shows:**
```
Headers:
  authorization: ***
  content-type: application/json
```

## Cookie-Based Sessions

```ts
import { httpDebugger } from 'http-debugger/express'
import cookieParser from 'cookie-parser'

app.use(cookieParser())
app.use(httpDebugger({
  sanitize: true,  // Redacts Cookie and Set-Cookie headers
}))

app.post('/login', (req, res) => {
  res.cookie('session', 'abc123', { httpOnly: true, secure: true })
  res.json({ ok: true })
})
```

**Dashboard shows:**
```
Request Headers:
  cookie: ***

Response Headers:
  set-cookie: ***
```

## Custom Sanitization

```ts
import { httpDebugger } from 'http-debugger/express'

app.use(httpDebugger({
  sanitize: true,  // Built-in: Authorization, Cookie, Set-Cookie, Proxy-Authorization
  filter: (entry) => {
    // Custom: don't log health checks
    return !entry.request.path.includes('/health')
  }
}))
```

## Next.js App Router

```ts
// app/api/auth/route.ts
import { withHttpDebugger } from 'http-debugger/next'

async function handler(req: Request) {
  const auth = req.headers.get('authorization')
  // http-debugger captures sanitized headers
  return Response.json({ authenticated: !!auth })
}

export const GET = withHttpDebugger(handler, { sanitize: true })
export const POST = withHttpDebugger(handler, { sanitize: true })
```

## What Gets Redacted

| Header | Redacted? |
|--------|-----------|
| `Authorization` | ✅ Yes |
| `Cookie` | ✅ Yes |
| `Set-Cookie` | ✅ Yes |
| `Proxy-Authorization` | ✅ Yes |
| `X-API-Key` | ❌ No (add custom filter if needed) |
| `X-CSRF-Token` | ❌ No (add custom filter if needed) |

## Custom Header Redaction

```ts
import { sanitizeHeaders } from 'http-debugger'

const customSanitized = sanitizeHeaders(headers, true)
// Then manually redact additional headers
for (const key of Object.keys(customSanitized)) {
  if (key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
    customSanitized[key] = '***'
  }
}
```