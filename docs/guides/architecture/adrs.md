# Architecture Decision Records

## ADR-001: Zero Runtime Dependencies

**Date:** 2024-07-28
**Status:** Accepted

**Context:** The library must be lightweight and not add to bundle size.

**Decision:** No runtime dependencies. Framework adapters use peer dependencies (express, fastify, hono).

**Consequences:**
- Smaller install size
- No supply chain risk
- Framework upgrades don't break http-debugger

---

## ADR-002: Stream-Level Capture

**Date:** 2024-07-28
**Status:** Accepted

**Context:** Body parsers (express.json(), multer) consume the stream, preventing raw capture.

**Decision:** Intercept at the stream level before any body parser.

**Consequences:**
- Captures raw bytes (multipart, binary, text)
- Works without body-parser middleware
- Must be placed FIRST in middleware chain

---

## ADR-003: Smart Truncation with maxBodySize

**Date:** 2024-07-28
**Status:** Accepted

**Context:** Large bodies (file uploads, video) cause memory issues.

**Decision:** Capture up to `maxBodySize` bytes, then stop collecting but let stream flow.

**Consequences:**
- Memory safe by default (1KB)
- Stream continues to handler unmodified
- Truncated bodies marked with `bodyTruncated: true`

---

## ADR-004: performance.now() for Timing

**Date:** 2024-07-28
**Status:** Accepted

**Context:** `Date.now()` has millisecond precision; sub-ms timing needed.

**Decision:** Use `performance.now()` for high-resolution timing.

**Consequences:**
- Sub-millisecond accuracy
- Works in Node.js, Deno, Bun, Edge runtimes
- All timings relative to request start

---

## ADR-005: Factory Pattern for Dashboard Engine

**Date:** 2024-07-28
**Status:** Accepted

**Context:** Multiple servers in one process (tests, dev) need isolated dashboard state.

**Decision:** `createDashboardEngine()` returns isolated instance per adapter registration.

**Consequences:**
- No cross-contamination between servers
- Each adapter instance manages its own ring buffer
- Dashboard route shares engine via singleton in Next.js adapter

---

## ADR-006: globalThis Singleton for Next.js HMR

**Date:** 2024-07-28
**Status:** Accepted

**Context:** Next.js dev mode clears module cache on every file save, destroying in-memory state.

**Decision:** Store dashboard engine on `globalThis.__httpDebuggerEngine` in development.

**Consequences:**
- Survives HMR cache clears
- Production creates fresh engine per import (no global state)
- No disk I/O, no external dependencies

---

## ADR-007: Non-Blocking Response Capture

**Date:** 2024-07-28
**Status:** Accepted

**Context:** Awaiting response body blocks streaming (SSE, AI text streams).

**Decision:** Clone response, process clone in background IIFE, return original immediately.

**Consequences:**
- Streaming responses work without buffering
- Background errors swallowed (logged via `.catch()`)
- Timing marks: `markHandlerEnd()` before handler, `markResponseStart()` before clone read

---

## ADR-008: Web Fetch API for Edge Compatibility

**Date:** 2024-07-28
**Status:** Accepted

**Context:** Hono and Next.js run on Cloudflare Workers, Vercel Edge, Deno — no Node.js streams.

**Decision:** Use `ReadableStream`, `Request.clone()`, `Response.clone()` — WinterCG standard APIs.

**Consequences:**
- Runs on Cloudflare Workers, Vercel Edge, Deno, Bun
- No Node.js `Buffer` or `stream` module
- Polyfill-free in modern runtimes

---

## ADR-009: Sanitization by Default

**Date:** 2024-07-28
**Status:** Accepted

**Context:** Auth tokens and cookies leak in logs.

**Decision:** `sanitize: true` by default redacts Authorization, Cookie, Set-Cookie, Proxy-Authorization.

**Consequences:**
- Secure by default
- Opt-out via `sanitize: false`
- Extensible via custom filter

---

## ADR-010: cURL Generation

**Date:** 2024-07-28
**Status:** Accepted

**Context:** Reproducing requests is essential for debugging.

**Decision:** Generate cURL from captured request (method, URL, headers, body).

**Consequences:**
- Works for all frameworks
- Conditional via `curl: true | (entry) => boolean`
- Truncated bodies marked with warning comment

---

## ADR-011: TypeDoc + VitePress for Docs

**Date:** 2024-07-28
**Status:** Accepted

**Context:** API reference must stay in sync with code.

**Decision:** TypeDoc generates API reference; VitePress builds guides.

**Consequences:**
- API docs never stale
- Single source of truth (TypeScript source)
- JSR also hosts auto-generated docs