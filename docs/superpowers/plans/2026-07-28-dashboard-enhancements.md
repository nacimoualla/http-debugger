# Dashboard UX + HAR Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add advanced filtering, HAR export, pause/clear controls to the embedded web dashboard — all client-side, zero server changes.

**Architecture:** Client-side only. Enhanced `DASHBOARD_HTML` with filter toolbar, HAR export dropdown, pause/clear controls. Extended `DashboardEngine` with `getAllEntries`, `clear`, `pause`, `resume`, `isPaused`, `setMaxEntries`. All logic in browser; SSE stream unchanged.

**Tech Stack:** TypeScript, vanilla JS in `DASHBOARD_HTML`, Vitest for unit tests

## Global Constraints

- Node.js >= 18
- Zero runtime dependencies (dashboard is embedded string)
- TypeScript strict mode
- Vitest for tests
- No new server endpoints or framework adapter changes
- Buffer max configurable via `dashboard.maxEntries` (default 5000)
- Minimal HAR must import in Chrome DevTools (Network → Import)
- Filter hot path <1ms per SSE event with 5 active predicates
- Filter input debounced 150ms; predicates pre-compiled
- Buffer default 5000 entries, configurable via `dashboard.maxEntries` (min 100, max 50000)

---

### Task 1: Extend DashboardEngine API

**Files:**
- Modify: `src/core/dashboard.ts`
- Test: `tests/core/dashboard.test.ts`

**Interfaces:**
- Produces: `DashboardEngine` with `getAllEntries(): DebugEntry[]`, `clear(): void`, `pause(): void`, `resume(): void`, `isPaused: boolean`, `setMaxEntries(n: number): void`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/dashboard.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDashboardEngine } from '../../src/core/dashboard.js';
import type { DebugEntry } from '../../src/types.js';

function createEntry(overrides: Partial<DebugEntry> = {}): DebugEntry {
  return {
    id: 'test-id',
    timestamp: Date.now(),
    request: { method: 'GET', path: '/test', headers: {}, body: null, bodyTruncated: false, query: {}, params: {} },
    response: { statusCode: 200, headers: {}, body: null, bodyTruncated: false, size: 0 },
    timing: { headersReceived: 1, bodyComplete: 2, handlerStart: 3, handlerEnd: 10, responseStart: 11, responseEnd: 15 },
    duration: 15,
    ...overrides,
  };
}

describe('DashboardEngine extended API', () => {
  let engine: ReturnType<typeof createDashboardEngine>;

  beforeEach(() => {
    engine = createDashboardEngine(10);
  });

  it('getAllEntries returns all buffered entries', () => {
    engine.addEntry(createEntry({ id: '1' }));
    engine.addEntry(createEntry({ id: '2' }));
    const entries = engine.getAllEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.id)).toEqual(['1', '2']);
  });

  it('clear empties the buffer', () => {
    engine.addEntry(createEntry({ id: '1' }));
    engine.clear();
    expect(engine.getAllEntries()).toHaveLength(0);
  });

  it('pause/resume toggles isPaused', () => {
    expect(engine.isPaused).toBe(false);
    engine.pause();
    expect(engine.isPaused).toBe(true);
    engine.resume();
    expect(engine.isPaused).toBe(false);
  });

  it('entries dropped when paused', () => {
    engine.addEntry(createEntry({ id: '1' }));
    engine.pause();
    engine.addEntry(createEntry({ id: '2' }));
    engine.resume();
    engine.addEntry(createEntry({ id: '3' }));
    const entries = engine.getAllEntries();
    expect(entries.map(e => e.id)).toEqual(['1', '3']);
  });

  it('setMaxEntries caps buffer and evicts oldest', () => {
    engine.setMaxEntries(3);
    engine.addEntry(createEntry({ id: '1' }));
    engine.addEntry(createEntry({ id: '2' }));
    engine.addEntry(createEntry({ id: '3' }));
    engine.addEntry(createEntry({ id: '4' }));
    const ids = engine.getAllEntries().map(e => e.id);
    expect(ids).toEqual(['2', '3', '4']);
  });

  it('setMaxEntries throws on invalid values', () => {
    expect(() => engine.setMaxEntries(50)).toThrow('min 100');
    expect(() => engine.setMaxEntries(60000)).toThrow('max 50000');
  });

  it('setMaxEntries works at runtime', () => {
    engine.addEntry(createEntry({ id: '1' }));
    engine.addEntry(createEntry({ id: '2' }));
    engine.addEntry(createEntry({ id: '3' }));
    engine.setMaxEntries(2);
    expect(engine.getAllEntries().length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/core/dashboard.test.ts`
Expected: FAIL with "getAllEntries is not a function" etc.

- [ ] **Step 3: Implement engine extensions**

```typescript
// src/core/dashboard.ts (add to createDashboardEngine return object)
  getAllEntries(): DebugEntry[] {
    return [...buffer];
  },

  clear(): void {
    buffer.length = 0;
  },

  pause(): void {
    paused = true;
  },

  resume(): void {
    paused = false;
  },

  get isPaused(): boolean {
    return paused;
  },

  setMaxEntries(max: number): void {
    if (max < 100) throw new Error('maxEntries min 100');
    if (max > 50000) throw new Error('maxEntries max 50000');
    maxEntries = max;
    while (buffer.length > maxEntries) buffer.shift();
  },
```

Add `paused: boolean = false` and `maxEntries: number` to closure scope. Update `addEntry` to check `paused` before pushing.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/core/dashboard.test.ts`
Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/dashboard.ts tests/core/dashboard.test.ts
git commit -m "feat: extend DashboardEngine with getAllEntries, clear, pause, resume, setMaxEntries"
```

---

### Task 2: Implement Filter Parser & Compiler

**Files:**
- Create: `src/core/filters.ts`
- Test: `tests/core/filters.test.ts`

**Interfaces:**
- Produces: `parseFilters(raw: RawFilters): CompiledPredicate[]`, `applyFilters(entry: DebugEntry, predicates: CompiledPredicate[]): boolean`

**RawFilters type:**
```typescript
interface RawFilters {
  method?: string[];      // ['GET', 'POST']
  status?: string[];      // ['2xx', '404']
  duration?: string;      // '>500ms', '<1s'
  size?: string;          // '<10KB', '>=1MB'
  dateRange?: { start?: number; end?: number }; // timestamps
}
```

**CompiledPredicate type:**
```typescript
type CompiledPredicate = (entry: DebugEntry) => boolean;
```

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/filters.test.ts
import { describe, it, expect } from 'vitest';
import { parseFilters, applyFilters, CompiledPredicate } from '../../src/core/filters.js';
import type { DebugEntry } from '../../src/types.js';

function entry(overrides: Partial<DebugEntry> = {}): DebugEntry {
  return {
    id: '1',
    timestamp: Date.now(),
    request: { method: 'GET', path: '/api/users', headers: {}, body: null, bodyTruncated: false, query: {}, params: {} },
    response: { statusCode: 200, headers: {}, body: null, bodyTruncated: false, size: 100 },
    timing: { headersReceived: 1, bodyComplete: 2, handlerStart: 3, handlerEnd: 10, responseStart: 11, responseEnd: 15 },
    duration: 15,
    ...overrides,
  };
}

describe('parseFilters', () => {
  it('parses method filter', () => {
    const preds = parseFilters({ method: ['GET', 'POST'] });
    expect(preds.length).toBe(1);
    expect(preds[0](entry({ request: { ...entry().request, method: 'GET' } }))).toBe(true);
    expect(preds[0](entry({ request: { ...entry().request, method: 'DELETE' } }))).toBe(false);
  });

  it('parses status filter with ranges', () => {
    const preds = parseFilters({ status: ['2xx', '404'] });
    expect(preds[0](entry({ response: { ...entry().response, statusCode: 200 } }))).toBe(true);
    expect(preds[0](entry({ response: { ...entry().response, statusCode: 404 } }))).toBe(true);
    expect(preds[0](entry({ response: { ...entry().response, statusCode: 500 } }))).toBe(false);
  });

  it('parses duration operators', () => {
    const preds = parseFilters({ duration: '>500ms' });
    expect(preds[0](entry({ duration: 600 }))).toBe(true);
    expect(preds[0](entry({ duration: 400 }))).toBe(false);
  });

  it('parses size operators with units', () => {
    const preds = parseFilters({ size: '<10KB' });
    const e = entry({ response: { ...entry().response, size: 5000 } });
    expect(preds[0](e)).toBe(true);
    const e2 = entry({ response: { ...entry().response, size: 20000 } });
    expect(preds[0](e2)).toBe(false);
  });

  it('parses date range', () => {
    const now = Date.now();
    const preds = parseFilters({ dateRange: { start: now - 3600000, end: now } });
    expect(preds[0](entry({ timestamp: now - 1800000 }))).toBe(true);
    expect(preds[0](entry({ timestamp: now - 7200000 }))).toBe(false);
  });

  it('returns empty array for empty input', () => {
    expect(parseFilters({})).toEqual([]);
    expect(parseFilters({ method: [] })).toEqual([]);
  });

  it('invalid operator returns no-op predicate', () => {
    const preds = parseFilters({ duration: '~500ms' });
    expect(preds[0](entry({ duration: 100 }))).toBe(true); // ignore invalid
  });
});

describe('applyFilters', () => {
  it('returns true when no predicates', () => {
    expect(applyFilters(entry(), [])).toBe(true);
  });

  it('ANDs all predicates', () => {
    const e = entry({ request: { method: 'POST' }, duration: 600 });
    const preds = [ (e: DebugEntry) => e.request.method === 'POST', (e: DebugEntry) => e.duration > 500 ];
    expect(applyFilters(e, preds)).toBe(true);
  });

  it('returns false if any predicate fails', () => {
    const e = entry({ request: { method: 'GET' }, duration: 600 });
    const preds = [ (e: DebugEntry) => e.request.method === 'POST', (e: DebugEntry) => e.duration > 500 ];
    expect(applyFilters(e, preds)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/core/filters.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement filters.ts**

```typescript
// src/core/filters.ts
import type { DebugEntry } from '../types.js';

export interface RawFilters {
  method?: string[];
  status?: string[];
  duration?: string;
  size?: string;
  dateRange?: { start?: number; end?: number };
}

export type CompiledPredicate = (entry: DebugEntry) => boolean;

const STATUS_RANGES: Record<string, [number, number]> = {
  '1xx': [100, 199], '2xx': [200, 299], '3xx': [300, 399], '4xx': [400, 499], '5xx': [500, 599],
};

function parseDuration(value: string): { op: string; ms: number } | null {
  const m = value.trim().match(/^([<>=!]=?)\s*(\d+(?:\.\d+)?)\s*(ms|s)$/i);
  if (!m) return null;
  const [, op, num, unit] = m;
  const ms = unit === 's' ? Number(num) * 1000 : Number(num);
  return { op, ms };
}

function parseSize(value: string): { op: string; bytes: number } | null {
  const m = value.trim().match(/^([<>=!]=?)\s*(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
  if (!m) return null;
  const [, op, num, unit] = m;
  const mult = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }[(unit || 'b').toLowerCase()];
  return { op, bytes: Number(num) * mult };
}

function makeCompare(op: string, value: number, getValue: (e: DebugEntry) => number): (e: DebugEntry) => boolean {
  switch (op) {
    case '>': return (e) => getValue(e) > value;
    case '>=': return (e) => getValue(e) >= value;
    case '<': return (e) => getValue(e) < value;
    case '<=': return (e) => getValue(e) <= value;
    case '=': return (e) => getValue(e) === value;
    default: return () => true; // invalid op = no-op
  }
}

export function parseFilters(raw: RawFilters): CompiledPredicate[] {
  const predicates: CompiledPredicate[] = [];

  if (raw.method?.length) {
    const set = new Set(raw.method.map(m => m.toUpperCase()));
    predicates.push((e) => set.has(e.request.method.toUpperCase()));
  }

  if (raw.status?.length) {
    const ranges: [number, number][] = [];
    const exact: number[] = [];
    for (const s of raw.status) {
      if (STATUS_RANGES[s]) ranges.push(STATUS_RANGES[s]);
      else if (/^\d{3}$/.test(s)) exact.push(parseInt(s));
    }
    predicates.push((e) => {
      const sc = e.response.statusCode;
      return ranges.some(([min, max]) => sc >= min && sc <= max) || exact.includes(sc);
    });
  }

  if (raw.duration) {
    const parsed = parseDuration(raw.duration);
    if (parsed) predicates.push(makeCompare(parsed.op, parsed.ms, (e) => e.duration));
  }

  if (raw.size) {
    const parsed = parseSize(raw.size);
    if (parsed) predicates.push(makeCompare(parsed.op, parsed.bytes, (e) => e.response.size));
  }

  if (raw.dateRange) {
    const { start, end } = raw.dateRange;
    predicates.push((e) => {
      if (start !== undefined && e.timestamp < start) return false;
      if (end !== undefined && e.timestamp > end) return false;
      return true;
    });
  }

  return predicates;
}

export function applyFilters(entry: DebugEntry, predicates: CompiledPredicate[]): boolean {
  return predicates.every(p => p(entry));
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/filters.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/filters.ts tests/core/filters.test.ts
git commit -m "feat: add filter parser and compiler for dashboard"
```

---

### Task 3: Enhanced DASHBOARD_HTML with Filter Toolbar & HAR Export

**Files:**
- Modify: `src/core/dashboard.ts`
- Test: `tests/core/dashboard.test.ts` (add HAR tests)

**Interfaces:**
- Consumes: `parseFilters`, `applyFilters` from `filters.ts`
- Produces: Updated `DASHBOARD_HTML` with filter toolbar, HAR export, pause/clear UI

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/dashboard.test.ts (add to existing)
import { it, expect } from 'vitest';
import { DASHBOARD_HTML } from '../../src/core/dashboard.js';

it('DASHBOARD_HTML contains filter toolbar', () => {
  expect(DASHBOARD_HTML).toContain('id="filter-method"');
  expect(DASHBOARD_HTML).toContain('id="filter-status"');
  expect(DASHBOARD_HTML).toContain('id="filter-duration"');
  expect(DASHBOARD_HTML).toContain('id="filter-size"');
  expect(DASHBOARD_HTML).toContain('id="filter-date-range"');
  expect(DASHBOARD_HTML).toContain('id="btn-clear"');
  expect(DASHBOARD_HTML).toContain('id="btn-har-export"');
  expect(DASHBOARD_HTML).toContain('id="btn-pause"');
});

it('DASHBOARD_HTML contains HAR export dropdown', () => {
  expect(DASHBOARD_HTML).toContain('Full HAR');
  expect(DASHBOARD_HTML).toContain('Minimal HAR');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/core/dashboard.test.ts`
Expected: FAIL

- [ ] **Step 3: Update DASHBOARD_HTML**

Replace the `<head><style>...</style></head><body>...</body>` section in `DASHBOARD_HTML` with enhanced version. Key additions:

```html
<!-- In header, add toolbar -->
<div class="toolbar">
  <div class="filter-row">
    <select id="filter-method" multiple title="Method">
      <option value="GET">GET</option><option value="POST">POST</option>
      <option value="PUT">PUT</option><option value="DELETE">DELETE</option>
      <option value="PATCH">PATCH</option><option value="HEAD">HEAD</option>
      <option value="OPTIONS">OPTIONS</option><option value="OTHER">OTHER</option>
    </select>
    <select id="filter-status" multiple title="Status">
      <optgroup label="1xx"><option value="1xx">1xx</option></optgroup>
      <optgroup label="2xx"><option value="2xx">2xx</option></optgroup>
      <optgroup label="3xx"><option value="3xx">3xx</option></optgroup>
      <optgroup label="4xx"><option value="4xx">4xx</option><option value="404">404</option></optgroup>
      <optgroup label="5xx"><option value="5xx">5xx</option></optgroup>
    </select>
    <input type="text" id="filter-duration" placeholder="Duration (e.g. >500ms)" title="Duration filter">
    <input type="text" id="filter-size" placeholder="Size (e.g. <10KB)" title="Size filter">
    <select id="filter-date-range" title="Date range">
      <option value="">All time</option>
      <option value="5m">Last 5 minutes</option>
      <option value="15m">Last 15 minutes</option>
      <option value="1h">Last 1 hour</option>
      <option value="6h">Last 6 hours</option>
      <option value="24h">Last 24 hours</option>
      <option value="custom">Custom range...</option>
    </select>
  </div>
  <div class="action-row">
    <span id="entry-counter">0 of 0 entries</span>
    <button id="btn-clear" title="Clear all">Clear</button>
    <div class="dropdown">
      <button id="btn-har-export">Export HAR ▼</button>
      <div class="dropdown-menu">
        <button data-har-type="full">Full HAR 1.2</button>
        <button data-har-type="minimal">Minimal HAR</button>
      </div>
    </div>
    <button id="btn-pause" title="Pause">Pause</button>
  </div>
```

In `<script>` section:
- Import `parseFilters`, `applyFilters` via global (inline in HTML) or add to `DASHBOARD_HTML` script
- Add filter state, compilation, debounce logic
- Add `generateHAR(full)` function
- Add event listeners for filter inputs (debounced 150ms), HAR buttons, pause/clear buttons
- Update `renderList` to use `filteredEntries`
- Add `paused` flag handling in `onmessage`

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/core/dashboard.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/dashboard.ts tests/core/dashboard.test.ts
git commit -m "feat: enhance dashboard HTML with filter toolbar, HAR export, pause/clear"
```

---

### Task 4: Wire Filters into DashboardEngine

**Files:**
- Modify: `src/core/dashboard.ts`
- Modify: `src/next.ts` (update DashboardOptions if needed)

**Interfaces:**
- Consumes: `parseFilters` from `filters.ts`
- Produces: Dashboard serves HTML with filter logic; engine supports pause/clear

- [ ] **Step 1: Import and use filters in dashboard.ts**

Add to imports: `import { parseFilters, applyFilters, type CompiledPredicate } from './filters.js';`

In `DASHBOARD_HTML` script:
```javascript
// Compile filters with debounce
let compiledPredicates: CompiledPredicate[] = [];
let filterTimeout: number;
function recompileFilters() {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(() => {
    const raw = {
      method: Array.from(document.querySelectorAll('#filter-method option:checked')).map(o => o.value),
      status: Array.from(document.querySelectorAll('#filter-status option:checked')).map(o => o.value),
      duration: (document.getElementById('filter-duration') as HTMLInputElement).value,
      size: (document.getElementById('filter-size') as HTMLInputElement).value,
      dateRange: parseDateRange(),
    };
    compiledPredicates = parseFilters(raw);
    renderList();
  }, 150);
}

// Attach listeners
document.getElementById('filter-method')!.addEventListener('change', recompileFilters);
// ... similar for other filters
```

- [ ] **Step 2: Add HAR generation**

```javascript
function generateHAR(full: boolean): string {
  const har = {
    log: {
      version: '1.2',
      creator: { name: 'http-debugger', version: '1.3.0' },
      pages: full ? [{ id: 'page_1', startedDateTime: new Date().toISOString(), title: 'http-debugger session' }] : [],
      entries: entries.filter(e => applyFilters(e, compiledPredicates)).map(e => mapEntry(e, full))
    }
  };
  return JSON.stringify(har, null, 2);
}

function mapEntry(e: DebugEntry, full: boolean) {
  const entry = {
    pageref: 'page_1',
    startedDateTime: new Date(e.timestamp).toISOString(),
    time: e.duration,
    request: { method: e.request.method, url: e.request.path, httpVersion: 'HTTP/1.1', ... },
    response: { status: e.response.statusCode, statusText: STATUS_TEXT[e.response.statusCode] || '', ... },
    cache: {},
    timings: { blocked: -1, dns: -1, connect: -1, send: 0, wait: e.timing.handlerEnd - e.timing.handlerStart, receive: e.timing.responseEnd - e.timing.responseStart }
  };
  if (full) {
    entry.pageref = 'page_1';
    entry.pages = [{ id: 'page_1', startedDateTime: new Date().toISOString(), title: 'http-debugger session' }];
    // add full headers, queryString, cookies, postData
  }
  return entry;
}

function downloadHAR(full: boolean) {
  const har = generateHAR(full);
  const blob = new Blob([har], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `http-debugger-${full ? 'full' : 'minimal'}-${Date.now()}.har`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Wire pause/clear buttons**

```javascript
document.getElementById('btn-pause')!.addEventListener('click', () => {
  if (engine.isPaused) { engine.resume(); btn.textContent = 'Pause'; }
  else { engine.pause(); btn.textContent = 'Resume'; btn.classList.add('paused'); }
});

document.getElementById('btn-clear')!.addEventListener('click', () => {
  engine.clear();
  renderList();
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/core/dashboard.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/dashboard.ts
git commit -m "feat: wire filters, HAR export, pause/clear into dashboard HTML"
```

---

### Task 5: End-to-End Verification & Polish

**Files:**
- Test: `tests/adapters/next.test.ts` (or manual test via dev server)

- [ ] **Step 1: Manual smoke test**

```bash
npm run build
# Start a test server with http-debugger/next
# Visit http://localhost:3000/__debugger
# Verify:
# - Filter toolbar visible, all 5 inputs work
# - Filters apply instantly
# - "X of Y entries" updates
# - HAR Export → Full downloads .har, opens in Chrome DevTools
# - HAR Export → Minimal downloads .har, opens in Chrome DevTools
# - Clear button empties table
# - Pause/Resume toggles, "Paused" badge shows
# - Entry counter updates correctly
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: 98+ tests PASS

- [ ] **Step 3: Fix any regressions, commit**

```bash
git add -A
git commit -m "chore: polish dashboard UX, verify all tests pass"
```

---

### Task 6: Documentation Update

**Files:**
- Modify: `docs/guides/cookbook/dashboard.md` (create or update)
- Modify: `README.md` (add dashboard section)

- [ ] **Step 1: Add dashboard cookbook page**

```markdown
# Embedded Dashboard

Visit `/__debugger` to access the real-time request dashboard.

## Features
- **Live stream** — SSE updates in real-time
- **Filters** — Method, status, duration (>500ms), size (<10KB), date range
- **Pause** — Freeze the list without disconnecting
- **Clear** — Reset the buffer
- **HAR Export** — Full (Chrome DevTools compatible) or Minimal

## Keyboard Shortcuts
- `Space` — Pause/Resume
- `Delete` — Clear
- `E` — Export HAR (Full)
```

- [ ] **Step 2: Update README with dashboard screenshot/link**

- [ ] **Step 3: Commit**

```bash
git add docs/guides/cookbook/dashboard.md README.md
git commit -m "docs: add dashboard cookbook and README badge"
```

---

## Spec Coverage Check

| Spec Section | Task |
|--------------|------|
| DashboardEngine API extensions | Task 1 |
| Filter parser/compiler | Task 2 |
| Enhanced DASHBOARD_HTML | Task 3 |
| Wire filters/HAR/pause/clear | Task 3 |
| HAR Full/Minimal generation | Task 3 |
| Pause/Resume/Clear buttons | Task 3 |
| Ring buffer maxEntries | Task 1 |
| HAR minimal compliance | Task 3 (mapEntryMinimal) |
| Debounced filter compilation | Task 3 (150ms debounce) |
| Acceptance criteria | Task 5 |

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-28-dashboard-enhancements.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**