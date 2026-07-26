# http-debugger — Design Spec (V1)

**Date:** 2026-07-26
**Platform:** TypeScript/JS (Node.js)
**Package:** `http-debugger`
**Type:** HTTP debug middleware with terminal UI
**Target:** Multi-framework (Express, Fastify, Hono) via adapter pattern

---

## 1. Overview

A lightweight middleware that captures HTTP requests and responses at the Node.js stream level. Logs method, path, status, headers, body, and timing breakdown to the terminal. Works with any response method (`res.json`, `res.send`, `res.sendStatus`, `res.write`/`res.end`, streaming). Zero runtime dependencies.

**V1 Goal:** Express adapter with core capture, timing, formatting, and sanitization.

---

## 2. Architecture

**Approach:** Adapter Pattern — core library with framework-specific adapters. Each adapter hooks into the Node.js `IncomingMessage`/`ServerResponse` stream primitives to capture data regardless of which Express response method is used.

```
http-debugger/
├── src/
│   ├── core/
│   │   ├── capture.ts        ← Raw stream capture + body processing
│   │   ├── timing.ts         ← High-resolution timing measurement
│   │   ├── formatter.ts      ← Terminal output formatting (colors, layout)
│   │   └── sanitize.ts       ← Redact sensitive headers (Authorization, Cookie)
│   ├── adapters/
│   │   ├── express.ts        ← Express middleware adapter
│   │   ├── fastify.ts        ← Fastify plugin adapter (V1.1)
│   │   └── hono.ts           ← Hono middleware adapter (V1.1)
│   ├── types.ts              ← Shared types
│   └── index.ts              ← Public API exports
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

**Dependencies:** Zero runtime dependencies. Terminal colors use a minimal built-in ANSI helper.

**Module format:** ESM + CJS dual publish via `tsup`.

---

## 3. Core Types

```typescript
// src/types.ts

export interface TimingInfo {
  start: number;            // Date.now() when middleware begins
  headersReceived: number;  // When request headers are available
  bodyComplete: number;     // When request body stream ends (req 'end' event)
  handlerStart: number;     // Just before route handler executes
  handlerEnd: number;       // When route handler completes
  responseStart: number;    // When first response data is written (res.write/end)
  responseEnd: number;      // When response is fully sent (finish event)
}

export interface RequestCapture {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
}

export interface ResponseCapture {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  size: number;  // Response size in bytes (from chunks or content-length)
}

export interface DebugEntry {
  id: string;
  request: RequestCapture;
  response: ResponseCapture;
  timing: TimingInfo;
  duration: number;
}

export interface MiddlewareOptions {
  filter?: (entry: DebugEntry) => boolean;
  maxBodySize?: number;     // Default: 1024 bytes
  sanitize?: boolean;       // Default: true
  colors?: boolean;         // Default: true (auto-detects TTY)
}
```

---

## 4. Stream-Level Capture Strategy

The adapter captures data at the Node.js stream level, not at the Express API level. This means it works regardless of which response method is used.

### Request Capture

```
req.on('data') → collect chunks (up to maxBodySize) → req.on('end') → captureRequestBody(chunks)
```

- Hooks into `req.on` to intercept 'data' and 'end' events
- Collects raw `Buffer` chunks **up to `maxBodySize`** — once limit is reached, stops collecting and lets the stream pass through untouched
- On 'end', passes collected chunks to `captureRequestBody()` which handles JSON parsing, truncation messages, and error display
- Timing: `headersReceived` = middleware start, `bodyComplete` = req 'end' event

### Response Capture

```
res.write(chunk) → collect chunks (up to maxBodySize) → res.end(chunk) → finish event
```

- Wraps `res.write()` and `res.end()` to intercept all response data
- **Safety valve:** Collects chunks only up to `maxBodySize`. Once limit is reached, stops collecting — the stream continues flowing unmodified, preventing OOM on large responses (video files, downloads, etc.)
- Works with: `res.json()`, `res.send()`, `res.sendStatus()`, `res.sendFile()`, `res.write()`/`res.end()`, streaming
- Timing: `responseStart` = first `res.write`/`res.end` call, `responseEnd` = `finish` event

### Why This Matters

| Response Method | res.json only | Stream-level capture |
|-----------------|---------------|---------------------|
| `res.json(obj)` | Captures | Captures |
| `res.send(str)` | Misses | Captures |
| `res.sendStatus(200)` | Misses | Captures |
| `res.write(chunk)` + `res.end()` | Misses | Captures |
| `res.sendFile(path)` | Misses | Captures |
| Streaming response | Misses | Captures |

---

## 5. Terminal Output Format

```
→ POST /api/users
  Headers: { "content-type": "application/json", "authorization": "***" }
  Body: {
    "name": "Alice"
  }

← 201 Created (45ms)
  Headers: { "content-type": "application/json" }
  Body: {
    "id": 1,
    "name": "Alice"
  }
  Size: 67B

  Timing:
    Headers:  2ms
    Body:     1ms
    Handler:  38ms
    Response: 4ms
```

### Formatting Rules

| Element | Style |
|---------|-------|
| `→` arrow | Cyan for GET/HEAD, Green for POST/PUT/PATCH, Yellow for DELETE |
| `←` arrow | Green for 2xx, Yellow for 3xx, Red for 4xx/5xx |
| Headers | Dimmed |
| Body | Default color, truncated at `maxBodySize` |
| Timing labels | Dimmed |
| Sanitized values | `***` |

### Body Handling

- **JSON bodies:** Pretty-printed with 2-space indent
- **Non-JSON text:** Shown as-is, truncated at `maxBodySize`
- **Binary/unknown:** Show `[binary, 1.2KB]`
- **Empty bodies (204, 304):** Skip body display
- **Large bodies:** Truncate at `maxBodySize` with `[truncated, 2.4KB total]`
- **Parse errors:** Show `[parse error: <message>]`

### Sanitization

These headers are always redacted when `sanitize: true`:
- `Authorization`
- `Cookie`
- `Set-Cookie`
- `Proxy-Authorization`

---

## 6. Adapter API

### Express

```typescript
import { httpDebugger } from 'http-debugger/express';

const app = express();

// Must be FIRST middleware to capture request body streams
app.use(httpDebugger());

// With options:
app.use(httpDebugger({
  filter: (entry) => entry.request.path.startsWith('/api'),
  maxBodySize: 2048,
}));
```

**Critical:** The middleware must be registered BEFORE body-parser and route handlers to capture raw request body chunks. If registered after `express.json()`, the body stream is already consumed.

### Fastify (V1.1)

```typescript
import { httpDebugger } from 'http-debugger/fastify';
fastify.register(httpDebugger());
```

### Hono (V1.1)

```typescript
import { httpDebugger } from 'http-debugger/hono';
app.use('*', httpDebugger());
```

---

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Body parsing fails | Show `[parse error: <message>]`, continue |
| Request exceeds `maxBodySize` | **Safety valve:** Stop collecting chunks at limit, let stream pass through. Show `[truncated, X.XKB total]`. |
| Response exceeds `maxBodySize` | **Safety valve:** Same — stops collecting at limit. Prevents OOM on large responses (video, downloads). |
| Middleware throws internally | Log to stderr, never crash the request |
| Sanitize fails | Fall back to raw headers |
| Streaming response | Capture chunks up to limit, show final status |
| WebSocket upgrade | Print `↑ WebSocket upgrade`, skip capture |
| Empty body (204, 304) | Skip body display |
| Multiple `res.end()` calls | Guard against duplicate `finish` handlers |

**Key principle:** The middleware is purely observational. It never modifies the request or response, and never throws. The safety valve ensures it never buffers more than `maxBodySize` bytes — streams continue flowing unmodified once the limit is reached.

---

## 8. Testing Strategy

**Framework:** Vitest

### Unit Tests (core/)

- `capture.test.ts` — request/response body capture with raw Buffer chunks
- `timing.test.ts` — timing measurement accuracy
- `formatter.test.ts` — output format matches expected strings
- `sanitize.test.ts` — sensitive headers are redacted

### Integration Tests (adapters/)

- Spin up Express server with `http-debugger` as FIRST middleware
- Test all response methods: `res.json`, `res.send`, `res.sendStatus`, `res.write`+`res.end`, streaming
- Test request body capture without body-parser dependency
- Test timing accuracy across sync and async handlers

### Test Cases

| Category | Cases |
|----------|-------|
| Response methods | `res.json()`, `res.send()`, `res.sendStatus()`, `res.write()`+`res.end()`, streaming |
| Request body | JSON, form data, empty body, large body truncation |
| Timing | All fields populated, duration > 0, bodyComplete reflects actual stream end |
| Sanitize | Authorization, Cookie, Set-Cookie redacted |
| Options | filter, maxBodySize, sanitize=false, colors=false |
| Edge | 204 No Content, large responses, concurrent requests |

---

## 9. Package Configuration

### package.json

```json
{
  "name": "http-debugger",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./express": "./dist/adapters/express.js",
    "./types": "./dist/types.js"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "express": ">=4.0.0"
  },
  "peerDependenciesMeta": {
    "express": { "optional": true }
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "tsup": "^8.0.0",
    "vitest": "^2.0.0",
    "express": "^4.19.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

---

## 10. V1 Scope

### In Scope

- Core capture (raw stream chunks), timing, formatting, sanitization
- Express adapter (hooks into `req.on`, `res.write`, `res.end`)
- `MiddlewareOptions` (filter, maxBodySize, sanitize, colors)
- All response methods: `res.json`, `res.send`, `res.sendStatus`, `res.write`/`res.end`, streaming
- JSON and non-JSON body capture
- Timing breakdown (headers, body, handler, response)
- Sensitive header sanitization
- Body truncation
- Unit + integration tests
- npm publish setup (dual ESM/CJS)

### Out of Scope (Future)

- Fastify adapter (V1.1)
- Hono adapter (V1.1)
- Multipart form data capture
- WebSocket debugging
- Log persistence (save to file)
- Advanced filtering (by status code, method, path pattern)
- Performance metrics (avg response time, throughput)
- Custom formatters / plugin API

---

## 11. Implementation Order

| Step | Task | Dependencies |
|------|------|--------------|
| 1 | Set up package (tsconfig, tsup, vitest) | — |
| 2 | Implement `src/types.ts` | — |
| 3 | Implement `src/core/sanitize.ts` | types.ts |
| 4 | Implement `src/core/timing.ts` | types.ts |
| 5 | Implement `src/core/capture.ts` | types.ts |
| 6 | Implement `src/core/formatter.ts` | types.ts, sanitize.ts |
| 7 | Implement `src/adapters/express.ts` | core modules |
| 8 | Write unit tests for core modules | core modules |
| 9 | Write integration tests for Express adapter | express adapter |
| 10 | Set up build + publish config | package.json |
| 11 | Write README.md | all above |

---

## 12. AI Agent Coding Rules

These rules apply to all AI agents generating or modifying code in this project.

### No Comments

- **Never** add comments to code. Not inline, not block, not docstrings, not JSDoc.
- If code needs a comment, the code is unclear — refactor instead.
- Variable names, function names, and structure must communicate intent without annotation.

### Structure Code Like a Human

- Write code that reads like a senior engineer wrote it — clean, intentional, minimal.
- Prefer short, focused functions over long ones.
- Group related logic together; separate unrelated concerns.
- Use descriptive variable and function names that eliminate the need for comments.
- Keep nesting shallow — early returns, guard clauses, extracted helpers.
- No clever one-liners that sacrifice readability.
- Match the existing code style in the repo exactly.

### General

- Follow the architecture and patterns defined in this spec.
- Do not introduce dependencies unless explicitly allowed.
- Run `typecheck` and `test:run` after every change.

### Git & GitHub

- Branch from `main`. Never commit directly to `main`.
- Use clear, descriptive branch names: `feat/capture-logic`, `fix/timing-drift`, `chore/update-deps`.
- One logical change per commit. No mixed concerns.
- Commit messages: imperative mood, lowercase, no period. Example: `add request body capture`.
- Never commit secrets, tokens, or credentials.
- Before pushing, run `typecheck` and `test:run` — both must pass.
- Before creating a PR, inspect: `git status`, `git diff`, `git log --oneline -10`.
- PRs require all tests green. Do not merge with failures.
- Never force-push shared branches without explicit approval.
- Never skip hooks or use `--no-verify`.
- Keep `.gitignore` updated — no `node_modules`, `dist`, `.env`, or worktree dirs tracked.

---

## 13. Success Criteria

- [ ] `http-debugger/express` works as a drop-in FIRST middleware
- [ ] Captures request body from raw streams (no body-parser dependency)
- [ ] Captures response body from `res.json`, `res.send`, `res.sendStatus`, `res.write`/`res.end`
- [ ] Timing breakdown reflects actual stream events
- [ ] Sensitive headers are sanitized by default
- [ ] Zero runtime dependencies
- [ ] All tests pass
- [ ] Builds to ESM + CJS without errors

---

*End of Design Spec*
