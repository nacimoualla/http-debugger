# Dashboard UX + HAR Export Design

**Date:** 2026-07-28
**Status:** Approved
**Scope:** Enhance embedded web dashboard with advanced filtering, HAR export, and pause/clear controls

## Goal

Make the embedded dashboard a showcase feature for user acquisition: instant filtering, one-click HAR export, and pause/clear controls — all client-side, zero server changes.

## Architecture

**Client-side only.** All filtering, HAR generation, and pause logic run in the browser. SSE stream remains unchanged. Dashboard engine (`createDashboardEngine`) gets minor API additions (`getAllEntries`, `clear`, `pause`/`resume`).

```
User action (filter/export/pause)
        ↓
Client-side filter on `entries[]` array
        ↓
Render `filteredEntries` in table
        ↓
Export click → generateHAR(full) → blob download
```

---

## UI Layout (Iterate on Current)

### Header Toolbar (new)

```
┌─────────────────────────────────────────────────────────────────────┐
│ http-debugger                    [●] 12 of 100 entries   [Pause] ▼  │
├─────────────────────────────────────────────────────────────────────┤
│ [Method ▼] [Status ▼] [Duration >500ms] [Size <10KB] [Last 1h ▼]   │
│                         [Clear] [Export HAR ▼]                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Left:** App name + live badge + entry counter (filtered/total)
**Right:** Pause/Resume toggle + HAR export dropdown
**Filter row:** 5 inputs (Method, Status, Duration, Size, Date Range)
**Action row:** Clear button + HAR Export dropdown (Full/Minimal)

### Table (existing, enhanced)

- Same columns: Method, Path, Status, Duration
- Rows now from `filteredEntries` instead of `entries`
- Click → detail panel (unchanged)

### Detail Panel (unchanged)

- Request/Response headers, body, timing breakdown
- cURL command (if enabled)

---

## Filter Spec

| Filter | Input Type | Behavior |
|--------|------------|----------|
| **Method** | Multi-select dropdown | GET, POST, PUT, DELETE, PATCH, HEAD, OTHER |
| **Status** | Multi-select dropdown | 1xx, 2xx, 3xx, 4xx, 5xx (click expands to specific codes) |
| **Duration** | Free text with operators | `>500ms`, `<100ms`, `>=1s`, `<=500ms`, `=200ms` |
| **Size** | Free text with operators | `>10KB`, `<1MB`, `>=500B`, `<=100KB` |
| **Date Range** | Relative presets + Custom | Presets: Last 5m, 15m, 1h, 6h, 24h; Custom = two date pickers |

**Operators supported:** `>`, `<`, `>=`, `<=`, `=`
**Units:** `ms`, `s` for duration; `B`, `KB`, `MB` for size (case-insensitive)
**Parsing:** Client-side regex, invalid input = ignore filter

**Filter logic:** All active filters ANDed together. Empty filter = match all.

---

## HAR Export

### Dropdown Menu
```
Export HAR ▼
├── Full HAR 1.2 (with pages, full timings, creator)
┤ timings)
└── Minimal HAR (entries only, request/response basics)
```

### Full HAR 1.2 Spec
```json
{
  "log": {
    "version": "1.2",
    "creator": { "name": "http-debugger", "version": "1.3.0" },
    "pages": [{ "id": "page_1", "startedDateTime": "...", "title": "http-debugger session" }],
    "entries": [
      {
        "pageref": "page_1",
        "startedDateTime": "2024-01-15T10:30:00.000Z",
        "time": 45.2,
        "request": {
          "method": "GET",
          "url": "http://localhost:3000/api/users",
          "httpVersion": "HTTP/1.1",
          "headers": [{ "name": "content-type", "value": "application/json" }],
          "queryString": [{ "name": "page", "value": "1" }],
          "cookies": [],
          "headersSize": -1,
          "bodySize": 0
        },
        "response": {
          "status": 200,
          "statusText": "OK",
          "httpVersion": "HTTP/1.1",
          "headers": [{ "name": "content-type", "value": "application/json" }],
          "cookies": [],
          "content": { "size": 45, "mimeType": "application/json", "text": "{\"users\":[]}" },
          "headersSize": -1,
          "bodySize": 45
        },
        "cache": {},
        "timings": { "blocked": -1, "dns": -1, "connect": -1, "send": 0, "wait": 40, "receive": 5 },
        "_httpDebugger": { "truncated": false, "id": "abc123" }
      }
    ]
  }
}
```

### Minimal HAR
Same structure but:
- No `pages` array
- Only `entries` with: `request` (method, url, headers, body), `response` (status, headers, body), `time`
- No timings breakdown, no `_httpDebugger` extension

### Implementation
```typescript
function generateHAR(entries: DebugEntry[], full: boolean): string {
  const har = { log: { version: "1.2", creator: { name: "http-debugger", version }, pages: [], entries: [] } };
  if (full) har.log.pages.push({ id: "page_1", startedDateTime: ..., title: "http-debugger session" });
  entries.forEach(e => har.log.entries.push(mapEntry(e, full)));
  return JSON.stringify(har, null, 2);
}

function downloadHAR(har: string, full: boolean) {
  const blob = new Blob([har], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `http-debugger-${full ? "full" : "minimal"}-${Date.now()}.har`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## Pause / Clear

### Pause Button
- **Behavior:** SSE stays connected; new entries dropped locally (`pause` flag in engine)
- **Visual:** Toggle button `[Pause]` → `[Resume]` (red when paused)
- **Badge:** Shows "Paused" indicator next to entry counter
- **Resume:** Flips flag, new entries flow again; buffer unchanged

### Clear Button
- Calls `engine.clear()` → empties ring buffer + `entries` array
- Table renders empty immediately
- Counter shows "0 of 0 entries"

---

## Engine API Additions (`src/core/dashboard.ts`)

```typescript
interface DashboardEngine {
  // ... existing
  getAllEntries(): DebugEntry[];  // for HAR generation
  clear(): void;                   // Clear button
  pause(): void;                   // Pause button
  resume(): void;                  // Resume button
  isPaused: boolean;               // For UI state
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/core/dashboard.ts` | Enhanced `DASHBOARD_HTML` + engine API additions |
| `tests/core/dashboard.test.ts` | Tests for new engine methods, filter logic (unit), HAR generation |

---

## Tests

### Unit (dashboard.test.ts)
- `generateHAR(full: true)` produces valid HAR 1.2
- `generateHAR(full: false)` produces minimal HAR
- `engine.pause()` / `resume()` toggle `isPaused`
- `engine.clear()` empties buffer
- Filter parser: `">500ms"`, `"<10KB"`, `">=1s"`, `"=200ms"`, `"last 1h"`

### Integration (not needed for MVP)
- E2E with Playwright: filter → table updates, export → .har downloads

---

## Acceptance Criteria

- [ ] Filter toolbar renders with 5 inputs + action row
- [ ] All 5 filters apply instantly (no SSE disconnect)
- [ ] "X of Y entries" counter updates correctly
- [ ] HAR Export dropdown: Full + Minimal both download valid `.har`
- [ ] Downloaded HAR opens in Chrome DevTools (Network → Import)
- [ ] Clear button empties table + buffer
- [ ] Pause/Resume toggles without SSE reconnect
- [ ] "Paused" badge shows when paused
- [ ] All 98 existing tests still pass

---

## Non-Goals (Future)

- Column sorting
- Column visibility toggle
- Saved filter presets
- WebSocket frame capture in HAR
- Server-side filtering for >500 entries

---

## Trade-offs Accepted

| Decision | Rationale |
|----------|-----------|
| Client-side only | Zero server changes, instant filter, works offline |
| Free text operators | Powerful, single input, familiar to devs |
| Relative date presets | Covers 90% of debugging sessions |
| Local drop on pause | Instant resume, no SSE churn |
| Buffer max 5000 | Memory safe, configurable, sufficient for long sessions |
| HAR minimal compliance | Chrome DevTools import works without stubbing |
| Debounced filter compilation | O(1) per SSE event, no UI lag on fast streams |

---

## Spec Review

- [x] No placeholders/TODOs
- [x] Internal consistency (filter types match UI, HAR maps to DebugEntry)
- [x] Scope focused (no new server endpoints, no framework changes)
- [x] Ambiguities resolved (operators, presets, pause behavior)