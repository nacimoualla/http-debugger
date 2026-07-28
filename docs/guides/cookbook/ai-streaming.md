---
title: AI Streaming Responses
---

# Recipe: AI Streaming Responses

## Problem

Capture streaming responses from OpenAI, Anthropic, or other LLM providers without buffering the entire response. See each chunk in real-time in the dashboard.

## Solution

http-debugger handles streaming natively — it captures each chunk as it flows through the stream. Just ensure `maxBodySize` is large enough for your expected response.

## Code

```ts
// app/api/chat/route.ts (Next.js App Router)
import { withHttpDebugger } from 'http-debugger/next'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function handler(req: Request) {
  const { messages } = await req.json()

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    stream: true,
    max_tokens: 500
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content ?? ''
        if (content) {
          controller.enqueue(encoder.encode(content))
        }
      }
      controller.close()
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked'
    }
  })
}

export const POST = withHttpDebugger(handler, { maxBodySize: 8192 })
```

```ts
// app/api/anthropic/route.ts (Next.js App Router)
import { withHttpDebugger } from 'http-debugger/next'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function handler(req: Request) {
  const { messages } = await req.json()

  const stream = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    messages,
    max_tokens: 1024,
    stream: true
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    }
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}

export const POST = withHttpDebugger(handler, { maxBodySize: 8192 })
```

## Dashboard Result

Visit `/__debugger` to see:
- **Request**: POST /api/chat with full message history
- **Response**: Streaming chunks arriving in real-time via SSE
- **Timing**: First byte (TTFB) + total stream duration
- **cURL**: Complete command to replay the request

## Generated cURL

```bash
curl -X POST 'http://localhost:3000/api/chat' \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Explain quantum computing in 3 sentences"}]}'
```

## Configuration Tips

| Scenario | `maxBodySize` | Notes |
|----------|---------------|-------|
| Short responses (< 1KB) | 1024 (default) | Fine for most chat |
| Long responses (code, docs) | 8192-16384 | Increase for large outputs |
| Very long (reports, analysis) | 32768+ | Monitor memory |

## Express Version

```ts
import express from 'express'
import { httpDebugger } from 'http-debugger/express'
import OpenAI from 'openai'

const app = express()
app.use(httpDebugger({ maxBodySize: 8192 }))
app.use(express.json())

app.post('/chat', async (req, res) => {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: req.body.messages,
    stream: true
  })

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Transfer-Encoding', 'chunked')

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content ?? ''
    if (content) res.write(content)
  }
  res.end()
})
```

## Fastify Version

```ts
import Fastify from 'fastify'
import { httpDebugger } from 'http-debugger/fastify'
import OpenAI from 'openai'

const fastify = Fastify()
fastify.register(httpDebugger, { maxBodySize: 8192 })

fastify.post('/chat', async (request, reply) => {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: request.body.messages,
    stream: true
  })

  reply.header('Content-Type', 'text/plain; charset=utf-8')

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content ?? ''
    if (content) await reply.send(content)
  }
})
```