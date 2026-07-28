# Embedded Web Dashboard

**Date:** 2026-07-28
**Status:** Approved
**Scope:** Optional web dashboard for browsing captured HTTP requests in real-time

## Goal

Add an optional, zero-dependency web dashboard that shows captured HTTP requests in real-time. When enabled, developers open `/__debugger` in their browser to see a live-updating list of requests with details, search, and filtering.

## Architecture

```
Request → Middleware → isProduction? → Yes → next() (dashboard disabled)
                  ↓
                  No → matches /__debugger? → Yes → Serve HTML (short-circuit)
                  ↓                              ↓
                  No                     matches /__debugger/stream? → Yes → SSE connection + hydration
                  ↓                                                                       ↓
              next() → log to console → engine.addEntry() → buffer + broadcast to SSE clients
```

## Components

### 1. Dashboard Engine (Factory Function)

Each adapter instance gets its own isolated engine via `createDashboardEngine()`. This prevents cross-pollination when multiple servers run in the same process.

```typescript
// src/core/dashboard.ts
const isProduction = typeof process !== 'undefined'
  && process.env?.NODE_ENV === 'production';

export function createDashboardEngine(maxEntries: number = 100) {
  const buffer: DebugEntry[] = [];
  const clients = new Set<(chunk: string) => void>();

  return {
    isEnabled: !isProduction,

    addEntry(entry: DebugEntry) {
      if (buffer.length >= maxEntries) buffer.shift();
      buffer.push(entry);
      const payload = `data: ${JSON.stringify(entry)}\n\n`;
      clients.forEach(send => send(payload));
    },

    addClientWithHistory(sendFn: (chunk: string) => void): () => void {
      const history = buffer.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
      sendFn(history);
      clients.add(sendFn);
      return () => clients.delete(sendFn);
    },
  };
}
```

### 2. HTML UI (Embedded String)

- Single `const DASHBOARD_HTML = '...'` in `src/core/dashboard.ts`
- Vanilla CSS + vanilla JS (~15KB max)
- EventSource connection to `/__debugger/stream`
- Shows: request list, request details on click, search/filter
- Auto-updates via SSE (no polling)

### 3. Production Guard

Hardcoded safety check — dashboard is silently disabled when `NODE_ENV=production`.

```typescript
if (isProduction) {
  // Pass through to next(), serve 404 for /__debugger routes
}
```

### 4. SSE Broadcaster (Runtime-Agnostic)

Uses callback functions instead of framework-specific Response objects:

```typescript
const clients = new Set<(chunk: string) => void>();
```

| Adapter | `sendFn` wraps |
|---------|----------------|
| Express | `(chunk) => res.write(chunk)` |
| Fastify | `(chunk) => reply.raw.write(chunk)` |
| Hono | `(chunk) => controller.enqueue(new TextEncoder().encode(chunk))` |

### 5. Teardown on Disconnect

Critical for preventing memory leaks. Each adapter binds the teardown function to the client's disconnect event:

- **Express/Fastify:** `req.on('close', teardown)`
- **Hono:** `cancel()` method on ReadableStream

### 6. Hydration on Connect

When a client connects to `/__debugger/stream`:
1. Iterate over the ring buffer
2. Send all historical entries immediately via SSE
3. Then register for future broadcasts

## Configuration

```typescript
httpDebugger({
  dashboard: true,  // or { maxEntries: 200 }
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dashboard` | `boolean \| { maxEntries?: number }` | `false` | Enable the web dashboard |
| `dashboard.maxEntries` | `number` | `100` | Max requests in ring buffer |

## Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/__debugger` | GET | Serve dashboard HTML |
| `/__debugger/stream` | GET | SSE endpoint for real-time updates |

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/core/dashboard.ts` | Create | `createDashboardEngine()` factory, HTML string |
| `src/adapters/express.ts` | Modify | Instantiate engine, interceptor with teardown |
| `src/adapters/fastify.ts` | Modify | Instantiate engine, interceptor with teardown |
| `src/adapters/hono.ts` | Modify | Instantiate engine, interceptor with cancel() |
| `tests/core/dashboard.test.ts` | Create | Test factory isolation, hydration, teardown, production guard |

## Testing

- Factory isolation: two engines don't share state
- Ring buffer: shifts oldest when full
- Hydration: new client receives historical entries
- Teardown: dead clients removed from Set
- Production guard: dashboard disabled when NODE_ENV=production
- HTML serving: `/__debugger` returns valid HTML
