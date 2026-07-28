# Recipe: File Uploads (multipart/form-data)

Capture file uploads without buffering entire files into memory.

## Express with multer

```ts
import express from 'express'
import multer from 'multer'
import { httpDebugger } from 'http-debugger/express'

const app = express()

// http-debugger MUST come BEFORE multer to capture raw stream
app.use(httpDebugger({ maxBodySize: 10 * 1024 * 1024 })) // 10MB

const upload = multer({ dest: 'uploads/' })

app.post('/upload', upload.single('file'), (req, res) => {
  // req.file has file info
  // http-debugger captured the raw multipart stream
  res.json({ size: req.file?.size, mimetype: req.file?.mimetype })
})
```

## Express without multer (raw stream)

```ts
import { httpDebugger } from 'http-debugger/express'

app.use(httpDebugger({ maxBodySize: 50 * 1024 * 1024 })) // 50MB

app.post('/raw-upload', (req, res) => {
  // http-debugger captures the multipart boundary and parts
  // without any body parser
  res.json({ received: true })
})
```

## Hono

```ts
import { Hono } from 'hono'
import { httpDebugger } from 'http-debugger/hono'

const app = new Hono()
app.use('*', httpDebugger({ maxBodySize: 10 * 1024 * 1024 }))

app.post('/upload', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file')
  // http-debugger captured raw stream before formData parsing
  return c.json({ ok: true })
})
```

## Next.js App Router

```ts
// app/api/upload/route.ts
import { withHttpDebugger } from 'http-debugger/next'

async function handler(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file')
  return Response.json({ size: file?.size, type: file?.type })
}

export const POST = withHttpDebugger(handler, {
  maxBodySize: 10 * 1024 * 1024
})
```

## Dashboard Result

**Request Headers:**
```
content-type: multipart/form-data; boundary=----WebKitFormBoundary...
content-length: 2048576
```

**Request Body (truncated at maxBodySize):**
```
------WebKitFormBoundaryABC123
Content-Disposition: form-data; name="file"; filename="image.png"
Content-Type: image/png

[binary data - truncated at 1024 bytes]
------WebKitFormBoundaryABC123--
```

**Body shows:** `[truncated]` if file exceeds `maxBodySize`

## Tips

1. **Order matters** — Place `httpDebugger` BEFORE any body parser (multer, body-parser, etc.)
2. **Set appropriate `maxBodySize`** — Default 1KB is too small for files; use 10MB+
3. **Filter if needed** — Exclude upload endpoints from logging in production:
   ```ts
   httpDebugger({
     filter: (entry) => !entry.request.path.startsWith('/upload')
   })
   ```
4. **Memory safety** — http-debugger only captures up to `maxBodySize` bytes; the stream continues flowing to your handler unmodified