# Next.js Adapter Design

**Date:** 2026-07-28
**Status:** Approved
**Scope:** HOF wrapper for App Router Route Handlers + catch-all dashboard route

## Goal

Add a Next.js adapter that wraps App Router Route Handlers via a Higher-Order Function (HOF) and provides a catch-all route for the embedded web dashboard. Follows the `next-auth`/`@clerk/nextjs` pattern for drop-in file-based mounting.

## Architecture

```
http-debugger/next
├── withHttpDebugger(handler)   ← HOF wrapper for route handlers
├── dashboardRoute(options?)    ← Catch-all route for dashboard + config
└── singleton engine            ← globalThis-preserved across HMR
```

## User Experience

### 1. Wrap API routes

Developer wraps each handler in their route files:

```typescript
// app/api/users/route.ts
import { withHttpDebugger } from 'http-debugger/next';

async function handler(req: Request) {
  const data = await req.json();
  return Response.json({ users: [] });
}

export const GET = withHttpDebugger(handler);
export const POST = withHttpDebugger(handler);
```

### 2. Mount dashboard

Developer creates exactly one file for the dashboard:

```typescript
// app/__debugger/[[...route]]/route.ts
import { dashboardRoute } from 'http-debugger/next';

export const GET = dashboardRoute({
  maxDepth: 4,
  sanitize: true,
  curl: true,
});
```

## Components

### 1. Singleton Engine (`src/core/singleton.ts`)

Uses `globalThis` to preserve the engine across Next.js HMR in development. Same pattern as Prisma's client connection handling.

```typescript
import { createDashboardEngine, type DashboardEngine } from './dashboard.js';

const globalForDebugger = globalThis as unknown as {
  __httpDebuggerEngine: DashboardEngine | undefined;
};

export const engine: DashboardEngine =
  globalForDebugger.__httpDebuggerEngine ?? createDashboardEngine();

if (process.env.NODE_ENV !== 'production') {
  globalForDebugger.__httpDebuggerEngine = engine;
}
```

### 2. HOF Wrapper (`src/next.ts` — `withHttpDebugger`)

Wraps a Next.js App Router route handler. Captures request/response data and pushes to the singleton engine.

**Request capture:**
1. Clone the incoming `Request` via `req.clone()`
2. Read the clone's body via `ReadableStream` with byte limit (same as Hono adapter)
3. Parse JSON if Content-Type is `application/json`

**Response capture:**
1. Execute the user's handler: `const res = await handler(req)`
2. Clone the response: `const resClone = res.clone()`
3. Read the clone's body in the background (non-blocking)
4. Return the original `res` to Next.js immediately
5. On body read completion, construct `DebugEntry` and push to engine

**Timing:**
```
markHeadersReceived()  ← at wrapper entry
markBodyComplete()     ← after req body read
markHandlerStart()     ← before handler() call
markHandlerEnd()       ← after handler() returns
markResponseStart()    ← before res clone body read
markResponseEnd()      ← after res body captured
```

**Signature:**
```typescript
export function withHttpDebugger(
  handler: (req: Request) => Promise<Response> | Response,
  handlerOptions?: MiddlewareOptions
): (req: Request) => Promise<Response>;
```

Note: `handlerOptions` is optional per-route overrides. The singleton engine uses config from `dashboardRoute()` as the base; per-handler options can override individual fields.

### 3. Dashboard Route (`src/next.ts` — `dashboardRoute`)

Catch-all route handler for the dashboard. Acts as the **central configuration point** for the singleton engine.

```typescript
export function dashboardRoute(options?: DashboardOptions): (req: Request) => Promise<Response>;
```

When called:
- Stores formatting options (maxDepth, maxArrayItems, sanitize, colors, curl) in the singleton
- Initializes the engine's ring buffer with `maxEntries`
- Returns a route handler that intercepts:
  - `/__debugger` → serves `DASHBOARD_HTML`
  - `/__debugger/stream` → opens SSE connection via `engine.addClientWithHistory()`

### 4. Dashboard Options

Extends `MiddlewareOptions` with one additional field:

```typescript
interface DashboardOptions extends MiddlewareOptions {
  /** Max entries in ring buffer (default: 100). */
  maxEntries?: number;
}
```

The singleton engine stores these options. `withHttpDebugger()` uses them when calling `formatEntry()` for console output. The dashboard frontend receives raw `DebugEntry` JSON via SSE and handles display formatting client-side.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/core/singleton.ts` | Create | globalThis-preserved engine instance |
| `src/next.ts` | Create | `withHttpDebugger`, `dashboardRoute`, `DashboardOptions` |
| `tests/adapters/next.test.ts` | Create | Tests for HOF wrapper and dashboard route |
| `package.json` | Modify | Add `"./next"` export |
| `tsup.config.ts` | Modify | Add `src/next.ts` entry point |

## Key Design Decisions

### Why not middleware?

Next.js App Router doesn't have a traditional middleware pipeline for route handlers. Middleware (`middleware.ts`) runs on the edge and can't access route handler internals. The HOF pattern is the standard way to wrap individual handlers.

### Why globalThis for HMR?

Next.js `dev` mode aggressively clears the module cache on every file save. A standard module-level singleton would lose its ring buffer and SSE connections on every HMR. `globalThis` persists across cache clears.

### Why clone responses instead of wrapping Response.json()?

Monkey-patching global `Response.json()` would cause severe side effects across the framework. Cloning is safe, follows Web Standards, and matches the Hono adapter pattern.

### Why centralize config in dashboardRoute()?

With a singleton engine, per-handler config creates conflicts (Route A sets `maxDepth: 2`, Route B sets `maxDepth: 4`). Centralizing in `dashboardRoute()` gives a single source of truth. Per-handler `handlerOptions` can still override specific fields for logging.

## Testing

- HOF wraps handler and captures request/response
- Request body capture (JSON and plain text)
- Response body capture via clone
- Timing markers fire in correct order
- Dashboard serves HTML at `/__debugger`
- Dashboard serves SSE at `/__debugger/stream`
- SSE hydration sends historical entries
- SSE teardown on disconnect
- Production guard disables engine
- globalThis singleton survives module re-import
