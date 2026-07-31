---
layout: home

hero:
  name: "http-debugger"
  text: "Zero-dependency HTTP debug middleware"
  tagline: Stream-level request capture, smart body truncation, cURL generation, and framework adapters for Express, Fastify, Hono, and Next.js.
  image:
    src: /logo.svg
    alt: http-debugger logo
  actions:
    - theme: brand
      text: Get Started
      link: /guides/migration/from-morgan
    - theme: alt
      text: API Reference
      link: /api/
    - theme: alt
      text: View on GitHub
      link: https://github.com/nacimoualla/http-debugger

features:
  - icon: 🚀
    title: Stream-Level Capture
    details: Intercepts raw HTTP streams — no body parser middleware required. Captures request and response bodies exactly as they flow.
  - icon: ✂️
    title: Smart Body Truncation
    details: Configurable maxBodySize with automatic truncation. Deep JSON objects and large arrays collapse gracefully.
  - icon: 📋
    title: cURL Generation
    details: One-click reproduction. Generates ready-to-paste cURL commands with headers and body for any captured request.
  - icon: ⚡
    title: Zero Runtime Dependencies
    details: No dependencies in production. Framework adapters use only peer dependencies you already have.
  - icon: 🌐
    title: Edge-Compatible
    details: Hono and Next.js adapters use WinterCG standard APIs — runs on Cloudflare Workers, Deno, Bun, Vercel Edge.
  - icon: 📊
    title: Real-Time Dashboard
    details: Optional embedded web UI at /__debugger with SSE live updates, search, and request inspection.

---

## Quick Start

```bash
npm install http-debugger
```

### Express

```ts
import express from 'express'
import { httpDebugger } from 'http-debugger/express'

const app = express()
app.use(httpDebugger())
```

### Fastify

```ts
import Fastify from 'fastify'
import { httpDebugger } from 'http-debugger/fastify'

const fastify = Fastify()
fastify.register(httpDebugger)
```

### Hono

```ts
import { Hono } from 'hono'
import { httpDebugger } from 'http-debugger/hono'

const app = new Hono()
app.use('*', httpDebugger())
```

### Next.js (App Router)

```ts
// app/api/users/route.ts
import { withHttpDebugger } from 'http-debugger/next'

async function handler(req: Request) {
  return Response.json({ users: [] })
}

export const GET = withHttpDebugger(handler)

// app/__debugger/[[...route]]/route.ts
import { dashboardRoute } from 'http-debugger/next'

export const GET = dashboardRoute({ maxDepth: 4, sanitize: true })
```

---

## Why http-debugger?

| Feature | http-debugger | Morgan | Pino |
|---------|:---:|:---:|:---:|
| Stream-level capture | ✅ | ❌ | ❌ |
| Request body capture | ✅ | ❌ | ❌ |
| Response body capture | ✅ | ❌ | ❌ |
| Body truncation | ✅ | ❌ | ❌ |
| cURL generation | ✅ | ❌ | ❌ |
| Zero runtime deps | ✅ | ✅ | ❌ |
| TypeScript support | ✅ | ❌ | ✅ |
| Express | ✅ | ✅ | ✅ |
| Fastify | ✅ | ❌ | ✅ |
| Hono / Edge | ✅ | ❌ | ❌ |
| Next.js (App Router) | ✅ | ❌ | ❌ |
