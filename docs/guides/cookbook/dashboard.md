# Embedded Dashboard

The http-debugger includes a real-time web dashboard accessible at `/__debugger` when the dashboard option is enabled.

## Quick Start

```typescript
import { httpDebugger } from 'http-debugger/express';

app.use(httpDebugger({
  dashboard: true,  // or { maxEntries: 500 }
}));
```

Then visit `http://localhost:3000/__debugger` in your browser.

## Features

### Live Request Stream
- Real-time updates via Server-Sent Events (SSE)
- No page refresh needed
- Color-coded by HTTP method and status code

### Filters
| Filter | Input Type | Examples |
|--------|------------|----------|
| Method | Multi-select dropdown | GET, POST, PUT, DELETE |
| Status | Grouped multi-select | 2xx, 404, 500 |
| Duration | Free text with operators | `>500ms`, `<1s`, `>=200ms` |
| Size | Free text with units | `<10KB`, `>1MB`, `>=500B` |
| Date Range | Presets + custom | Last 5m, 1h, 24h, or custom range |

**Operators**: `>`, `>=`, `<`, `<=`, `=`  
**Units**: `ms`, `s` (duration) | `B`, `KB`, `MB` (size)

### Pause & Clear
- **Pause** — Freeze the list without disconnecting SSE. New requests are dropped locally.
- **Clear** — Empty the buffer and table instantly.

### HAR Export
- **Full HAR 1.2** — Full request/response bodies, headers, cookies, timings. Opens in Chrome DevTools (Network → Import).
- **Minimal HAR** — Lightweight: method, URL, status, headers, size only.

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Space` | Pause/Resume |
| `Delete` | Clear |
| `E` | Export Full HAR |

## Next.js App Router

```typescript
// app/__debugger/[[...route]]/route.ts
import { dashboardRoute } from 'http-debugger/next';

export const GET = dashboardRoute({
  maxDepth: 4,
  sanitize: true,
  curl: true,
});
```

Configure options:
```typescript
export const GET = dashboardRoute({
  maxDepth: 4,
  maxArrayItems: 10,
  sanitize: true,
  curl: true,
  maxEntries: 2000,
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dashboard` | `boolean \| { maxEntries?: number }` | `false` | Enable dashboard |
| `maxEntries` | `number` | `5000` | Max entries in ring buffer (100–50000) |

## Tips

- **Increase `maxEntries`** for long debugging sessions
- **Use filters** to isolate specific issues (e.g., `>500ms` + `5xx`)
- **Export HAR** to share with teammates or import into other tools
- **Pause** when investigating a specific request to prevent it from scrolling away

## Security

- Dashboard is **automatically disabled** when `NODE_ENV=production`
- Sanitization enabled by default (redacts Authorization, Cookie headers)
- No authentication built-in — protect the route in production if needed