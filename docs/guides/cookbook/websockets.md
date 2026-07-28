# Recipe: WebSocket Upgrade Capture

Capture HTTP upgrade requests and track WebSocket connections.

## Express with ws

```ts
import express from 'express'
import { WebSocketServer } from 'ws'
import { httpDebugger } from 'http-debugger/express'

const app = express()
app.use(httpDebugger({ maxBodySize: 1024 }))

const server = app.listen(3000)

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  // http-debugger captured the upgrade request
  console.log('Client connected:', req.socket.remoteAddress)

  ws.on('message', (data) => {
    ws.send(`Echo: ${data}`)
  })
})
```

## Hono (Cloudflare Workers compatible)

```ts
import { Hono } from 'hono'
import { httpDebugger } from 'http-debugger/hono'

const app = new Hono()
app.use('*', httpDebugger())

// WebSocket upgrade handled by platform
app.get('/ws', (c) => {
  // Upgrade request captured by http-debugger
  return c.text('Upgrade to WebSocket')
})
```

## Next.js App Router (Vercel Edge)

```ts
// app/api/ws/route.ts
import { withHttpDebugger } from 'http-debugger/next'

// Note: Next.js doesn't support WebSocket upgrades in App Router
// This captures the initial HTTP request only
async function handler(req: Request) {
  return new Response('WebSocket upgrade not supported in App Router', { status: 400 })
}

export const GET = withHttpDebugger(handler)
```

## Dashboard Result

**Upgrade Request:**
```
→ GET /ws
  upgrade: websocket
  connection: upgrade
  sec-websocket-key: dGhlIHNhbXBsZSBub25jZQ==
  sec-websocket-version: 13

← 101 Switching Protocols (5ms)
  upgrade: websocket
  connection: upgrade
  sec-websocket-accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

## Limitations

| Platform | Upgrade Capture | Notes |
|----------|-----------------|-------|
| Express + ws | ✅ Full | Captures upgrade request/response |
| Hono + Cloudflare | ⚠️ Partial | Workers handle upgrade differently |
| Next.js App Router | ❌ None | No WebSocket support in App Router |
| Fastify + fastify-websocket | ✅ Full | Captures via onRequest hook |

## Tips

1. **Only captures the upgrade handshake** — WebSocket frames after upgrade are not HTTP, so http-debugger doesn't capture them
2. **Filter if noisy** — Exclude WebSocket endpoints if they create noise:
   ```ts
   httpDebugger({
     filter: (entry) => !entry.request.headers.upgrade?.includes('websocket')
   })
   ```
3. **Use dedicated WS logging** — For frame-level debugging, use a WebSocket-specific logger alongside http-debugger