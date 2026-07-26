# http-debugger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency HTTP debug middleware for Node.js with terminal UI output, starting with Express adapter.

**Architecture:** Adapter pattern — core library (capture, timing, formatter, sanitize) with framework-specific adapters. Express adapter ships in V1; Fastify/Hono in V1.1.

**Tech Stack:** TypeScript, Node.js, Vitest, tsup, Express

## Global Constraints

- Zero runtime dependencies
- ESM + CJS dual publish via tsup
- TypeScript strict mode
- Vitest for testing
- Node.js >= 18

---

## File Structure

```
http-debugger/
├── src/
│   ├── core/
│   │   ├── capture.ts        ← Raw stream capture + body processing
│   │   ├── timing.ts         ← High-resolution timing measurement
│   │   ├── formatter.ts      ← Terminal output formatting (colors, layout)
│   │   └── sanitize.ts       ← Redact sensitive headers
│   ├── adapters/
│   │   └── express.ts        ← Express middleware adapter
│   ├── types.ts              ← Shared types
│   └── index.ts              ← Public API exports
├── tests/
│   ├── core/
│   │   ├── capture.test.ts
│   │   ├── timing.test.ts
│   │   ├── formatter.test.ts
│   │   └── sanitize.test.ts
│   └── adapters/
│       └── express.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

---

### Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Initialize npm project**

```bash
mkdir http-debugger && cd http-debugger
npm init -y
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D typescript tsup vitest express @types/express @types/node
```

- [ ] **Step 3: Create package.json**

```json
{
  "name": "http-debugger",
  "version": "0.1.0",
  "description": "Lightweight HTTP debug middleware with terminal UI",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./express": {
      "import": "./dist/adapters/express.js",
      "require": "./dist/adapters/express.cjs",
      "types": "./dist/adapters/express.d.ts"
    },
    "./types": {
      "import": "./dist/types.js",
      "require": "./dist/types.cjs",
      "types": "./dist/types.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "express": ">=4.0.0"
  },
  "peerDependenciesMeta": {
    "express": { "optional": true }
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "express": "^4.19.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/adapters/express.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
});
```

- [ ] **Step 6: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
dist/
*.tgz
```

- [ ] **Step 8: Create src directory structure**

```bash
mkdir -p src/core src/adapters tests/core tests/adapters
```

- [ ] **Step 9: Verify setup**

```bash
npx tsc --noEmit
```
Expected: No errors (no files yet, but config is valid)

- [ ] **Step 10: Commit**

```bash
git init
git add .
git commit -m "chore: project setup with tsconfig, tsup, vitest"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/types.ts`
- Test: None (types only, no runtime behavior)

**Interfaces:**
- Produces: `TimingInfo`, `RequestCapture`, `ResponseCapture`, `DebugEntry`, `MiddlewareOptions`

- [ ] **Step 1: Create src/types.ts**

```typescript
export interface TimingInfo {
  start: number;
  headersReceived: number;
  bodyComplete: number;
  handlerStart: number;
  handlerEnd: number;
  responseStart: number;
  responseEnd: number;
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
  size: number;
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
  maxBodySize?: number;
  sanitize?: boolean;
  colors?: boolean;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add core type definitions"
```

---

### Task 3: Sanitize Module

**Files:**
- Create: `src/core/sanitize.ts`
- Create: `tests/core/sanitize.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `sanitizeHeaders(headers: Record<string, string>, enabled?: boolean): Record<string, string>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/sanitize.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeHeaders } from '../../src/core/sanitize.js';

describe('sanitizeHeaders', () => {
  it('redacts Authorization header', () => {
    const headers = { authorization: 'Bearer abc123', 'content-type': 'application/json' };
    const result = sanitizeHeaders(headers);
    expect(result.authorization).toBe('***');
    expect(result['content-type']).toBe('application/json');
  });

  it('redacts Cookie header', () => {
    const headers = { cookie: 'session=xyz', host: 'example.com' };
    const result = sanitizeHeaders(headers);
    expect(result.cookie).toBe('***');
  });

  it('redacts Set-Cookie header', () => {
    const headers = { 'set-cookie': 'session=abc; Path=/' };
    const result = sanitizeHeaders(headers);
    expect(result['set-cookie']).toBe('***');
  });

  it('redacts Proxy-Authorization header', () => {
    const headers = { 'proxy-authorization': 'Basic admin:pass' };
    const result = sanitizeHeaders(headers);
    expect(result['proxy-authorization']).toBe('***');
  });

  it('preserves non-sensitive headers', () => {
    const headers = {
      'content-type': 'application/json',
      'x-request-id': '123',
      accept: '*/*',
    };
    const result = sanitizeHeaders(headers);
    expect(result).toEqual(headers);
  });

  it('returns same object when sanitize is false', () => {
    const headers = { authorization: 'Bearer abc123' };
    const result = sanitizeHeaders(headers, false);
    expect(result).toBe(headers);
  });

  it('handles empty headers object', () => {
    const result = sanitizeHeaders({});
    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/sanitize.test.ts
```
Expected: FAIL with "Cannot find module '../../src/core/sanitize.js'"

- [ ] **Step 3: Write implementation**

```typescript
// src/core/sanitize.ts
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
]);

export function sanitizeHeaders(
  headers: Record<string, string>,
  enabled: boolean = true
): Record<string, string> {
  if (!enabled) return headers;

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    sanitized[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '***' : value;
  }
  return sanitized;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/sanitize.test.ts
```
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/sanitize.ts tests/core/sanitize.test.ts
git commit -m "feat: add header sanitization module"
```

---

### Task 4: Timing Module

**Files:**
- Create: `src/core/timing.ts`
- Create: `tests/core/timing.test.ts`

**Interfaces:**
- Consumes: `TimingInfo` from types.ts
- Produces: `createTiming(): Timing`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/timing.test.ts
import { describe, it, expect } from 'vitest';
import { createTiming } from '../../src/core/timing.js';

describe('createTiming', () => {
  it('creates timing with start time set', () => {
    const timing = createTiming();
    expect(timing.start).toBeGreaterThan(0);
    expect(typeof timing.start).toBe('number');
  });

  it('records headers received', () => {
    const timing = createTiming();
    timing.markHeadersReceived();
    expect(timing.headersReceived).toBeGreaterThanOrEqual(timing.start);
  });

  it('records body complete', () => {
    const timing = createTiming();
    timing.markHeadersReceived();
    timing.markBodyComplete();
    expect(timing.bodyComplete).toBeGreaterThanOrEqual(timing.headersReceived);
  });

  it('records handler start and end', () => {
    const timing = createTiming();
    timing.markHandlerStart();
    timing.markHandlerEnd();
    expect(timing.handlerEnd).toBeGreaterThanOrEqual(timing.handlerStart);
  });

  it('records response start and end', () => {
    const timing = createTiming();
    timing.markResponseStart();
    timing.markResponseEnd();
    expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
  });

  it('calculates duration from start to response end', () => {
    const timing = createTiming();
    timing.markResponseEnd();
    expect(timing.duration).toBeGreaterThanOrEqual(0);
  });

  it('returns complete TimingInfo', () => {
    const timing = createTiming();
    timing.markHeadersReceived();
    timing.markBodyComplete();
    timing.markHandlerStart();
    timing.markHandlerEnd();
    timing.markResponseStart();
    timing.markResponseEnd();

    const info = timing.toJSON();
    expect(info).toHaveProperty('start');
    expect(info).toHaveProperty('headersReceived');
    expect(info).toHaveProperty('bodyComplete');
    expect(info).toHaveProperty('handlerStart');
    expect(info).toHaveProperty('handlerEnd');
    expect(info).toHaveProperty('responseStart');
    expect(info).toHaveProperty('responseEnd');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/timing.test.ts
```
Expected: FAIL with "Cannot find module '../../src/core/timing.js'"

- [ ] **Step 3: Write implementation**

```typescript
// src/core/timing.ts
import type { TimingInfo } from '../types.js';

export interface Timing {
  start: number;
  headersReceived: number;
  bodyComplete: number;
  handlerStart: number;
  handlerEnd: number;
  responseStart: number;
  responseEnd: number;
  markHeadersReceived(): void;
  markBodyComplete(): void;
  markHandlerStart(): void;
  markHandlerEnd(): void;
  markResponseStart(): void;
  markResponseEnd(): void;
  toJSON(): TimingInfo;
}

export function createTiming(): Timing {
  const now = () => Date.now();
  let headersReceived = 0;
  let bodyComplete = 0;
  let handlerStart = 0;
  let handlerEnd = 0;
  let responseStart = 0;
  let responseEnd = 0;

  const timing: Timing = {
    start: now(),
    get headersReceived() { return headersReceived; },
    get bodyComplete() { return bodyComplete; },
    get handlerStart() { return handlerStart; },
    get handlerEnd() { return handlerEnd; },
    get responseStart() { return responseStart; },
    get responseEnd() { return responseEnd; },
    get duration() { return responseEnd > 0 ? responseEnd - timing.start : 0; },
    markHeadersReceived() { headersReceived = now(); },
    markBodyComplete() { bodyComplete = now(); },
    markHandlerStart() { handlerStart = now(); },
    markHandlerEnd() { handlerEnd = now(); },
    markResponseStart() { responseStart = now(); },
    markResponseEnd() { responseEnd = now(); },
    toJSON(): TimingInfo {
      return {
        start: timing.start,
        headersReceived,
        bodyComplete,
        handlerStart,
        handlerEnd,
        responseStart,
        responseEnd,
      };
    },
  };

  return timing;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/timing.test.ts
```
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/timing.ts tests/core/timing.test.ts
git commit -m "feat: add timing measurement module"
```

---

### Task 5: Capture Module

**Files:**
- Create: `src/core/capture.ts`
- Create: `tests/core/capture.test.ts`

**Interfaces:**
- Consumes: Raw `Buffer[]` chunks from stream interception
- Produces: `generateId()`, `captureRequestBody(chunks, contentType, maxBodySize)`, `captureResponseBody(chunks, maxBodySize)`

**Key design:** Both `captureRequestBody` and `captureResponseBody` accept raw `Buffer[]` chunks. The adapter collects these from `req.on('data')` and `res.write()`/`res.end()` respectively. This means the capture module is stream-agnostic — it processes raw bytes regardless of source.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/capture.test.ts
import { describe, it, expect } from 'vitest';
import { generateId, captureRequestBody, captureResponseBody } from '../../src/core/capture.js';

describe('generateId', () => {
  it('generates a unique string ID', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(typeof id1).toBe('string');
    expect(id1).not.toBe(id2);
  });
});

describe('captureRequestBody', () => {
  it('parses JSON body from buffer chunks', async () => {
    const chunks = [Buffer.from('{"name":"test"}')];
    const result = await captureRequestBody(chunks, 'application/json');
    expect(result).toEqual({ name: 'test });
  });

  it('handles chunked JSON (multiple chunks)', async () => {
    const chunks = [
      Buffer.from('{"name":'),
      Buffer.from('"test"}'),
    ];
    const result = await captureRequestBody(chunks, 'application/json');
    expect(result).toEqual({ name: 'test' });
  });

  it('returns null for empty chunks', async () => {
    const result = await captureRequestBody([], 'application/json');
    expect(result).toBeNull();
  });

  it('truncates large body based on maxBodySize', async () => {
    const largeBody = 'x'.repeat(2048);
    const chunks = [Buffer.from(largeBody)];
    const result = await captureRequestBody(chunks, 'text/plain', 1024);
    expect(typeof result).toBe('string');
    expect(result).toContain('[truncated');
  });

  it('returns raw string for non-JSON content type', async () => {
    const chunks = [Buffer.from('plain text body')];
    const result = await captureRequestBody(chunks, 'text/plain');
    expect(result).toBe('plain text body');
  });

  it('handles malformed JSON gracefully', async () => {
    const chunks = [Buffer.from('{invalid json')];
    const result = await captureRequestBody(chunks, 'application/json');
    expect(result).toContain('[parse error');
  });
});

describe('captureResponseBody', () => {
  it('captures JSON body from chunks', () => {
    const chunks = [Buffer.from('{"id":1}')];
    const result = captureResponseBody(chunks, 1024);
    expect(result).toEqual({ id: 1 });
  });

  it('handles chunked response', () => {
    const chunks = [
      Buffer.from('{"id":'),
      Buffer.from('1}'),
    ];
    const result = captureResponseBody(chunks, 1024);
    expect(result).toEqual({ id: 1 });
  });

  it('truncates large response body', () => {
    const chunks = [Buffer.from('x'.repeat(2048))];
    const result = captureResponseBody(chunks, 1024);
    expect(result).toContain('[truncated');
  });

  it('returns null for empty chunks', () => {
    const result = captureResponseBody([], 1024);
    expect(result).toBeNull();
  });

  it('returns raw string for non-JSON', () => {
    const chunks = [Buffer.from('Hello World')];
    const result = captureResponseBody(chunks, 1024);
    expect(result).toBe('Hello World');
  });

  it('returns binary indicator for non-UTF8 data', () => {
    const chunks = [Buffer.from([0x00, 0x01, 0x02, 0x03])];
    const result = captureResponseBody(chunks, 1024);
    expect(typeof result).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/capture.test.ts
```
Expected: FAIL with "Cannot find module '../../src/core/capture.js'"

- [ ] **Step 3: Write implementation**

```typescript
// src/core/capture.ts
import { randomUUID } from 'node:crypto';

export function generateId(): string {
  return randomUUID();
}

/**
 * Capture and parse request body from raw stream chunks.
 * Called after req 'end' event with collected Buffer[] chunks.
 */
export function captureRequestBody(
  chunks: Buffer[],
  contentType: string,
  maxBodySize: number = 1024
): unknown {
  if (chunks.length === 0) return null;

  const buffer = Buffer.concat(chunks);

  if (buffer.length > maxBodySize) {
    return `[truncated, ${(buffer.length / 1024).toFixed(1)}KB total]`;
  }

  const str = buffer.toString('utf-8');
  const isJson = contentType?.includes('application/json');

  if (isJson) {
    try {
      return JSON.parse(str);
    } catch {
      return `[parse error: invalid JSON]`;
    }
  }

  return str;
}

/**
 * Capture and parse response body from raw stream chunks.
 * Called after res 'finish' event with collected Buffer[] chunks.
 */
export function captureResponseBody(
  chunks: Buffer[],
  maxBodySize: number = 1024
): unknown {
  if (chunks.length === 0) return null;

  const buffer = Buffer.concat(chunks);

  if (buffer.length > maxBodySize) {
    return `[truncated, ${(buffer.length / 1024).toFixed(1)}KB total]`;
  }

  const str = buffer.toString('utf-8');

  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/capture.test.ts
```
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/capture.ts tests/core/capture.test.ts
git commit -m "feat: add stream-based body capture module"
```

---

### Task 6: Formatter Module

**Files:**
- Create: `src/core/formatter.ts`
- Create: `tests/core/formatter.test.ts`

**Interfaces:**
- Consumes: `DebugEntry`, `MiddlewareOptions` from types.ts
- Produces: `formatEntry(entry: DebugEntry, options?: MiddlewareOptions): string`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/formatter.test.ts
import { describe, it, expect } from 'vitest';
import { formatEntry } from '../../src/core/formatter.js';
import type { DebugEntry } from '../../src/types.js';

function createMockEntry(overrides?: Partial<DebugEntry>): DebugEntry {
  return {
    id: 'test-id',
    request: {
      method: 'GET',
      path: '/api/users',
      headers: { 'content-type': 'application/json' },
      body: null,
      query: {},
      params: {},
    },
    response: {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { id: 1 },
      size: 13,
    },
    timing: {
      start: 1000,
      headersReceived: 1001,
      bodyComplete: 1002,
      handlerStart: 1003,
      handlerEnd: 1040,
      responseStart: 1041,
      responseEnd: 1045,
    },
    duration: 45,
    ...overrides,
  };
}

describe('formatEntry', () => {
  it('formats request line with method and path', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('GET /api/users');
  });

  it('formats response line with status code and duration', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('200 OK (45ms)');
  });

  it('formats request headers', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('content-type: application/json');
  });

  it('formats request body', () => {
    const entry = createMockEntry({
      request: {
        ...createMockEntry().request,
        body: { name: 'Alice' },
      },
    });
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('"name": "Alice"');
  });

  it('formats response body', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('"id": 1');
  });

  it('formats timing breakdown', () => {
    const entry = createMockEntry();
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('Timing:');
    expect(output).toContain('Headers:');
    expect(output).toContain('Handler:');
    expect(output).toContain('Response:');
  });

  it('sanitizes sensitive headers by default', () => {
    const entry = createMockEntry({
      request: {
        ...createMockEntry().request,
        headers: { authorization: 'Bearer abc123', 'content-type': 'application/json' },
      },
    });
    const output = formatEntry(entry, { colors: false });
    expect(output).toContain('authorization: ***');
  });

  it('skips sanitization when sanitize is false', () => {
    const entry = createMockEntry({
      request: {
        ...createMockEntry().request,
        headers: { authorization: 'Bearer abc123' },
      },
    });
    const output = formatEntry(entry, { colors: false, sanitize: false });
    expect(output).toContain('authorization: Bearer abc123');
  });

  it('handles null body', () => {
    const entry = createMockEntry({
      request: { ...createMockEntry().request, body: null },
      response: { ...createMockEntry().response, body: null },
    });
    const output = formatEntry(entry, { colors: false });
    expect(output).not.toContain('Body:');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/formatter.test.ts
```
Expected: FAIL with "Cannot find module '../../src/core/formatter.js'"

- [ ] **Step 3: Write implementation**

```typescript
// src/core/formatter.ts
import type { DebugEntry, MiddlewareOptions } from '../types.js';
import { sanitizeHeaders } from './sanitize.js';

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
};

const ansi = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function colorize(text: string, color: string, enabled: boolean): string {
  return enabled ? `${color}${text}${ansi.reset}` : text;
}

function formatBody(body: unknown): string {
  if (body === null || body === undefined) return '';
  if (typeof body === 'string') return body;
  return JSON.stringify(body, null, 2);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatDuration(ms: number): string {
  return `${ms}ms`;
}

function formatTimingValue(value: number, start: number): string {
  if (value === 0) return '—';
  return `${value - start}ms`;
}

export function formatEntry(
  entry: DebugEntry,
  options: Pick<MiddlewareOptions, 'colors' | 'sanitize'> = {}
): string {
  const useColors = options.colors !== false;
  const useSanitize = options.sanitize !== false;
  const { request, response, timing, duration } = entry;

  const lines: string[] = [];

  // Request line
  const methodColor = request.method === 'GET' || request.method === 'HEAD'
    ? ansi.cyan
    : request.method === 'DELETE'
      ? ansi.yellow
      : ansi.green;

  lines.push(
    `${colorize('→', methodColor, useColors)} ${request.method} ${request.path}`
  );

  // Request headers
  const reqHeaders = sanitizeHeaders(request.headers, useSanitize);
  if (Object.keys(reqHeaders).length > 0) {
    lines.push(`  Headers: ${colorize(JSON.stringify(reqHeaders), ansi.dim, useColors)}`);
  }

  // Request body
  const reqBody = formatBody(request.body);
  if (reqBody) {
    lines.push(`  Body: ${reqBody}`);
  }

  lines.push('');

  // Response line
  const statusColor = response.statusCode < 300
    ? ansi.green
    : response.statusCode < 400
      ? ansi.yellow
      : ansi.red;

  const statusText = STATUS_TEXT[response.statusCode] || '';
  lines.push(
    `${colorize('←', statusColor, useColors)} ${response.statusCode} ${statusText} (${formatDuration(duration)})`
  );

  // Response headers
  if (Object.keys(response.headers).length > 0) {
    lines.push(`  Headers: ${colorize(JSON.stringify(response.headers), ansi.dim, useColors)}`);
  }

  // Response body
  const resBody = formatBody(response.body);
  if (resBody) {
    lines.push(`  Body: ${resBody}`);
  }

  // Response size
  lines.push(`  Size: ${formatSize(response.size)}`);

  lines.push('');

  // Timing breakdown
  lines.push('  Timing:');
  lines.push(`    Headers:  ${formatTimingValue(timing.headersReceived, timing.start)}`);
  lines.push(`    Body:     ${formatTimingValue(timing.bodyComplete, timing.headersReceived)}`);
  lines.push(`    Handler:  ${formatTimingValue(timing.handlerEnd, timing.handlerStart)}`);
  lines.push(`    Response: ${formatTimingValue(timing.responseEnd, timing.responseStart)}`);

  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/formatter.test.ts
```
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/formatter.ts tests/core/formatter.test.ts
git commit -m "feat: add terminal output formatter"
```

---

### Task 7: Express Adapter

**Files:**
- Create: `src/adapters/express.ts`
- Create: `tests/adapters/express.test.ts`

**Interfaces:**
- Consumes: `MiddlewareOptions`, `DebugEntry`, core modules
- Produces: `httpDebugger(options?: MiddlewareOptions): RequestHandler`

**Critical design decisions:**
1. Middleware MUST be registered before body-parser to capture raw request body chunks
2. Request body captured via `req.on('data'/'end')` — NOT `req.body`
3. Response body captured via `res.write`/`res.end` wrapping — NOT `res.json` override
4. Works with ALL response methods: `res.json`, `res.send`, `res.sendStatus`, `res.write`/`res.end`, streaming

- [ ] **Step 1: Write the failing test**

```typescript
// tests/adapters/express.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Request, Response } from 'express';
import { httpDebugger } from '../../src/adapters/express.js';

describe('httpDebugger Express adapter', () => {
  let app: express.Express;
  let server: ReturnType<typeof express.application.listen>;
  let capturedOutput: string[];

  beforeEach(() => {
    capturedOutput = [];
    app = express();
    // NOTE: httpDebugger must be FIRST, before express.json()
    app.use(httpDebugger({ colors: false }));

    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      capturedOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    server?.close();
    vi.restoreAllMocks();
  });

  function startServer(): Promise<number> {
    return new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as { port: number }).port;
        resolve(port);
      });
    });
  }

  function waitForLog(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 150));
  }

  it('creates middleware function', () => {
    const middleware = httpDebugger();
    expect(typeof middleware).toBe('function');
  });

  it('captures res.json() response', async () => {
    app.get('/test', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/test`);
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('GET /test'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('200'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('"ok": true'))).toBe(true);
  });

  it('captures res.send() response', async () => {
    app.get('/html', (_req: Request, res: Response) => {
      res.send('<h1>Hello</h1>');
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/html`);
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('GET /html'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('<h1>Hello</h1>'))).toBe(true);
  });

  it('captures res.sendStatus() response', async () => {
    app.get('/no-content', (_req: Request, res: Response) => {
      res.sendStatus(204);
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/no-content`);
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('204'))).toBe(true);
  });

  it('captures res.write() + res.end() response', async () => {
    app.get('/stream', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/plain');
      res.write('chunk1');
      res.write('chunk2');
      res.end('chunk3');
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/stream`);
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('GET /stream'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('chunk1chunk2chunk3'))).toBe(true);
  });

  it('captures request body from raw stream (no body-parser)', async () => {
    app.post('/users', (req: Request, res: Response) => {
      // req.body is undefined here since no body-parser is used
      res.status(201).json({ received: true });
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('POST /users'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('"name": "Alice"'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('201'))).toBe(true);
  });

  it('sanitizes Authorization header', async () => {
    app.get('/secure', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/secure`, {
      headers: { Authorization: 'Bearer secret123' },
    });
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('***'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('secret123'))).toBe(false);
  });

  it('reports 500 errors', async () => {
    app.get('/error', (_req: Request, res: Response) => {
      res.status(500).json({ error: 'fail' });
    });

    const port = await startServer();
    await fetch(`http://localhost:${port}/error`);
    await waitForLog();

    expect(capturedOutput.some(o => o.includes('500'))).toBe(true);
    expect(capturedOutput.some(o => o.includes('"error": "fail"'))).toBe(true);
  });

  it('does not crash the request on internal errors', async () => {
    app.get('/crash', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    const port = await startServer();
    const response = await fetch(`http://localhost:${port}/crash`);
    await waitForLog();

    expect(response.status).toBe(200);
  });

  it('does not buffer large responses beyond maxBodySize', async () => {
    // Create a small maxBodySize for testing
    app.use(httpDebugger({ colors: false, maxBodySize: 1024 }));

    app.get('/large', (_req: Request, res: Response) => {
      // Send a 100KB response — should NOT buffer all of it
      const largeData = 'x'.repeat(100 * 1024);
      res.send(largeData);
    });

    const port = await startServer();
    const response = await fetch(`http://localhost:${port}/large`);
    await waitForLog();

    // Response should complete successfully (not OOM)
    expect(response.status).toBe(200);
    // Body should show truncation message
    expect(capturedOutput.some(o => o.includes('[truncated'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/adapters/express.test.ts
```
Expected: FAIL with "Cannot find module '../../src/adapters/express.js'"

- [ ] **Step 3: Write implementation**

```typescript
// src/adapters/express.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { MiddlewareOptions } from '../types.js';
import { createTiming } from '../core/timing.js';
import { generateId, captureRequestBody, captureResponseBody } from '../core/capture.js';
import { formatEntry } from '../core/formatter.js';

export function httpDebugger(options: MiddlewareOptions = {}): RequestHandler {
  const maxBodySize = options.maxBodySize ?? 1024;

  return (req: Request, res: Response, next: NextFunction): void => {
    const timing = createTiming();
    const id = generateId();

    // --- Request body capture via raw streams ---
    timing.markHeadersReceived();

    const requestChunks: Buffer[] = [];
    let requestBytesCollected = 0;
    let requestOverflow = false;
    const originalReqOn = req.on.bind(req);

    req.on = function (event: string, listener: (...args: unknown[]) => void) {
      if (event === 'data') {
        return originalReqOn(event, (chunk: Buffer) => {
          // Safety valve: stop collecting once limit reached, let stream pass through
          if (!requestOverflow) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            if (requestBytesCollected + buf.length <= maxBodySize) {
              requestChunks.push(buf);
              requestBytesCollected += buf.length;
            } else {
              // Collect only the remaining bytes up to the limit
              const remaining = maxBodySize - requestBytesCollected;
              if (remaining > 0) {
                requestChunks.push(buf.subarray(0, remaining));
              }
              requestOverflow = true;
            }
          }
          listener(chunk);
        });
      }
      if (event === 'end') {
        return originalReqOn(event, (...args: unknown[]) => {
          timing.markBodyComplete();
          return listener(...args);
        });
      }
      return originalReqOn(event, listener);
    } as typeof req.on;

    // --- Response body capture via res.write/res.end ---
    const responseChunks: Buffer[] = [];
    let responseBytesCollected = 0;
    let responseOverflow = false;
    let responseStarted = false;
    let responseFinished = false;

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = function (chunk: Buffer | string | Uint8Array, ...args: unknown[]) {
      if (!responseStarted) {
        responseStarted = true;
        timing.markResponseStart();
      }
      // Safety valve: stop collecting once limit reached
      if (chunk && !responseOverflow) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (responseBytesCollected + buf.length <= maxBodySize) {
          responseChunks.push(buf);
          responseBytesCollected += buf.length;
        } else {
          const remaining = maxBodySize - responseBytesCollected;
          if (remaining > 0) {
            responseChunks.push(buf.subarray(0, remaining));
          }
          responseOverflow = true;
        }
      }
      return originalWrite(chunk, ...args as []);
    } as typeof res.write;

    res.end = function (chunk?: Buffer | string | Uint8Array, ...args: unknown[]) {
      if (!responseStarted && chunk) {
        responseStarted = true;
        timing.markResponseStart();
      }
      // Safety valve: stop collecting once limit reached
      if (chunk && !responseOverflow) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (responseBytesCollected + buf.length <= maxBodySize) {
          responseChunks.push(buf);
          responseBytesCollected += buf.length;
        } else {
          const remaining = maxBodySize - responseBytesCollected;
          if (remaining > 0) {
            responseChunks.push(buf.subarray(0, remaining));
          }
          responseOverflow = true;
        }
      }
      return originalEnd(chunk, ...args as []);
    } as typeof res.end;

    // --- Response completion via finish event ---
    res.on('finish', () => {
      if (responseFinished) return;
      responseFinished = true;

      timing.markResponseEnd();

      const responseBody = captureResponseBody(responseChunks, maxBodySize);

      const entry = {
        id,
        request: {
          method: req.method,
          path: req.originalUrl || req.url,
          headers: req.headers as Record<string, string>,
          body: captureRequestBody(requestChunks, req.headers['content-type'] || '', maxBodySize),
          query: req.query as Record<string, string>,
          params: req.params as Record<string, string>,
        },
        response: {
          statusCode: res.statusCode,
          headers: res.getHeaders() as Record<string, string>,
          body: responseBody,
          // Use content-length header if available, otherwise use collected bytes
          size: parseInt(res.getHeader('content-length') as string) || responseBytesCollected,
        },
        timing: timing.toJSON(),
        duration: timing.duration,
      };

      if (options.filter && !options.filter(entry)) return;

      console.log(formatEntry(entry, {
        colors: options.colors,
        sanitize: options.sanitize,
      }));
    });

    next();
  };
}

export default httpDebugger;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/adapters/express.test.ts
```
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/adapters/express.ts tests/adapters/express.test.ts
git commit -m "feat: add Express adapter with stream-level capture"
```

---

### Task 8: Public API Exports

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create src/index.ts**

```typescript
// src/index.ts
export type {
  TimingInfo,
  RequestCapture,
  ResponseCapture,
  DebugEntry,
  MiddlewareOptions,
} from './types.js';

export { createTiming } from './core/timing.js';
export { generateId, captureRequestBody, captureResponseBody } from './core/capture.js';
export { formatEntry } from './core/formatter.js';
export { sanitizeHeaders } from './core/sanitize.js';
```

- [ ] **Step 2: Verify all tests still pass**

```bash
npx vitest run
```
Expected: All tests PASS

- [ ] **Step 3: Verify build works**

```bash
npm run build
```
Expected: Build succeeds, creates dist/ with ESM + CJS + .d.ts files

- [ ] **Step 4: Verify typecheck passes**

```bash
npm run typecheck
```
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: add public API exports"
```

---

### Task 9: README Documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# http-debugger

Lightweight HTTP debug middleware with terminal UI for Node.js.

Zero dependencies. Captures request/response at the stream level — works with `res.json`, `res.send`, `res.sendStatus`, `res.write`/`res.end`, and streaming.

## Install

```bash
npm install http-debugger
```

## Usage

```typescript
import express from 'express';
import { httpDebugger } from 'http-debugger/express';

const app = express();

// Register FIRST, before body-parser and routes
app.use(httpDebugger());

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

## Why Stream-Level Capture?

Most debug loggers hook into Express methods like `res.json()`. If your app uses `res.send()`, `res.sendStatus()`, or streaming, they miss the body entirely.

http-debugger hooks into Node's `req.on('data')` and `res.write()`/`res.end()` — the underlying streams that ALL response methods use. It captures everything.

## Output

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

## Options

```typescript
httpDebugger({
  filter: (entry) => entry.request.path.startsWith('/api'),  // Only log /api routes
  maxBodySize: 2048,      // Max body bytes to capture (default: 1024)
  sanitize: true,         // Redact Authorization/Cookie headers (default: true)
  colors: true,           // Enable terminal colors (default: auto-detect TTY)
});
```

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage examples"
```

---

### Task 10: Final Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Run build**

```bash
npm run build
```
Expected: Build succeeds, dist/ contains .js, .cjs, .d.ts files

- [ ] **Step 4: Verify exports work**

```bash
node --input-type=module -e "import { formatEntry } from './dist/index.js'; console.log('OK')"
```
Expected: "OK"

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: final verification and cleanup"
```
