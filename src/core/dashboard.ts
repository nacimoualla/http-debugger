/* eslint-disable no-useless-escape */
import type { DebugEntry } from '../types.js';

export const DASHBOARD_HTML: string = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>http-debugger</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; }
    .header { padding: 16px 24px; border-bottom: 1px solid #21262d; display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 18px; font-weight: 600; }
    .header .status { font-size: 12px; color: #8b949e; }
    .header .status.connected { color: #3fb950; }
    .header .status.disconnected { color: #f85149; }
    .header .status.paused { color: #d29922; }
    .search { padding: 12px 24px; border-bottom: 1px solid #21262d; }
    .search input { width: 100%; padding: 8px 12px; background: #161b22; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font-size: 14px; }
    .search input:focus { outline: none; border-color: #58a6ff; }
    .toolbar { padding: 8px 24px; border-bottom: 1px solid #21262d; background: #161b22; }
    .filter-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .filter-row select, .filter-row input { padding: 6px 10px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font-size: 13px; min-width: 120px; }
    .filter-row select:focus, .filter-row input:focus { outline: none; border-color: #58a6ff; }
    .filter-row select[multiple] { min-height: 34px; }
    .filter-row optgroup { color: #8b949e; }
    .filter-row option { background: #161b22; color: #c9d1d9; }
    .action-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .action-row #entry-counter { font-size: 12px; color: #8b949e; margin-right: auto; }
    .action-row button { padding: 6px 12px; background: #21262d; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font-size: 13px; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
    .action-row button:hover { background: #30363d; border-color: #58a6ff; }
    .action-row button:active { background: #161b22; }
    .action-row button.paused { background: #d2992233; border-color: #d29922; color: #d29922; }
    .action-row button.danger:hover { background: #f8514933; border-color: #f85149; color: #f85149; }
    .dropdown { position: relative; display: inline-block; }
    .dropdown-menu { display: none; position: absolute; right: 0; top: 100%; margin-top: 4px; background: #161b22; border: 1px solid #30363d; border-radius: 6px; min-width: 160px; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    .dropdown-menu.open { display: block; }
    .dropdown-menu button { display: block; width: 100%; text-align: left; padding: 8px 12px; background: transparent; border: none; border-radius: 0; color: #c9d1d9; font-size: 13px; cursor: pointer; }
    .dropdown-menu button:hover { background: #21262d; }
    .dropdown-menu button:first-child { border-radius: 6px 6px 0 0; }
    .dropdown-menu button:last-child { border-radius: 0 0 6px 6px; }
    .list { overflow-y: auto; }
    .entry { padding: 12px 24px; border-bottom: 1px solid #21262d; cursor: pointer; display: flex; gap: 12px; align-items: center; }
    .entry:hover { background: #161b22; }
    .entry.selected { background: #1c2128; }
    .method { font-weight: 600; font-size: 12px; padding: 2px 6px; border-radius: 4px; min-width: 50px; text-align: center; }
    .method.GET { background: #1f6feb33; color: #58a6ff; }
    .method.POST { background: #23863633; color: #3fb950; }
    .method.PUT { background: #d29a0033; color: #d29922; }
    .method.DELETE { background: #f8514933; color: #f85149; }
    .method.PATCH { background: #a371f733; color: #a371f7; }
    .path { flex: 1; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-code { font-size: 12px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }
    .status-code.s2xx { background: #23863633; color: #3fb950; }
    .status-code.s3xx { background: #d29a0033; color: #d29922; }
    .status-code.s4xx { background: #f8514933; color: #f85149; }
    .status-code.s5xx { background: #f8514933; color: #f85149; }
    .duration { font-size: 12px; color: #8b949e; min-width: 60px; text-align: right; }
    .detail { padding: 16px 24px; border-bottom: 1px solid #21262d; display: none; }
    .detail.open { display: block; }
    .detail h3 { font-size: 14px; margin-bottom: 8px; color: #8b949e; }
    .detail pre { background: #161b22; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; line-height: 1.5; }
    .detail .section { margin-bottom: 16px; }
    .timing { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .timing .item { background: #161b22; padding: 8px; border-radius: 6px; text-align: center; }
    .timing .item .label { font-size: 11px; color: #8b949e; }
    .timing .item .value { font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <h1>http-debugger</h1>
    <span class="status disconnected" id="status">Connecting...</span>
  </div>
  <div class="search">
    <input type="text" id="search" placeholder="Filter by method, path, or status...">
  </div>
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
        <div class="dropdown-menu" id="har-dropdown">
          <button data-har-type="full">Full HAR 1.2</button>
          <button data-har-type="minimal">Minimal HAR</button>
        </div>
      </div>
      <button id="btn-pause" title="Pause">Pause</button>
    </div>
  </div>
  <div class="list" id="list"></div>
  <div class="detail" id="detail"></div>
  <script>
    // ===== Filter logic (inlined from filters.ts) =====
    const STATUS_RANGES = {
      '1xx': [100, 199],
      '2xx': [200, 299],
      '3xx': [300, 399],
      '4xx': [400, 499],
      '5xx': [500, 599],
    };

    function parseDuration(value) {
      // eslint-disable-line no-useless-escape
      const m = value.trim().match(/^([<>=!]=?)\s*([0-9]+(?:\.[0-9]+)?)\s*(ms|s)$/i);
      if (!m) return null;
      const [, op, num, unit] = m;
      const ms = unit === 's' ? Number(num) * 1000 : Number(num);
      return { op, ms };
    }

    function parseSize(value) {
      // eslint-disable-line no-useless-escape
      const m = value.trim().match(/^([<>=!]=?)\s*([0-9]+(?:\.[0-9]+)?)\s*(B|KB|MB|GB)?$/i);
      if (!m) return null;
      const [, op, num, unit] = m;
      const mult = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }[(unit || 'b').toLowerCase()];
      return { op, bytes: Number(num) * mult };
    }

    function makeCompare(op, value, getValue) {
      switch (op) {
        case '>': return (e) => getValue(e) > value;
        case '>=': return (e) => getValue(e) >= value;
        case '<': return (e) => getValue(e) < value;
        case '<=': return (e) => getValue(e) <= value;
        case '=': return (e) => getValue(e) === value;
        default: return () => true;
      }
    }

    function parseFilters(raw) {
      const predicates = [];

      if (raw.method?.length) {
        const set = new Set(raw.method.map(m => m.toUpperCase()));
        predicates.push((e) => set.has(e.request.method.toUpperCase()));
      }

      if (raw.status?.length) {
        const ranges = [];
        const exact = [];
        for (const s of raw.status) {
          if (STATUS_RANGES[s]) ranges.push(STATUS_RANGES[s]);
          else if (/^[0-9]{3}$/.test(s)) exact.push(parseInt(s));
        }
        predicates.push((e) => {
          const sc = e.response.statusCode;
          return ranges.some(([min, max]) => sc >= min && sc <= max) || exact.includes(sc);
        });
      }

      if (raw.duration) {
        const parsed = parseDuration(raw.duration);
        if (parsed) predicates.push(makeCompare(parsed.op, parsed.ms, (e) => e.duration));
        else predicates.push(() => true);
      }

      if (raw.size) {
        const parsed = parseSize(raw.size);
        if (parsed) predicates.push(makeCompare(parsed.op, parsed.bytes, (e) => e.response.size));
        else predicates.push(() => true);
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

    function applyFilters(entry, predicates) {
      return predicates.every(p => p(entry));
    }

    // ===== HAR generation =====
    function generateHAR(entries, full = true) {
      const now = new Date().toISOString();
      const har = {
        log: {
          version: '1.2',
          creator: { name: 'http-debugger', version: '1.0.0' },
          browser: { name: 'http-debugger', version: '1.0.0' },
          pages: [{ id: 'page_1', startedDateTime: now, title: 'http-debugger session', pageTimings: {} }],
          entries: entries.map((e, i) => {
            const startedDateTime = new Date(e.timestamp).toISOString();
            const request = {
              method: e.request.method,
              url: e.request.path,
              httpVersion: 'HTTP/1.1',
              cookies: [],
              headers: Object.entries(e.request.headers || {}).map(([name, value]) => ({ name, value })),
              queryString: Object.entries(e.request.query || {}).map(([name, value]) => ({ name, value: String(value) })),
              headersSize: -1,
              bodySize: e.request.body ? JSON.stringify(e.request.body).length : -1,
            };
            if (full && e.request.body) {
              request.postData = {
                mimeType: e.request.headers?.['content-type'] || 'application/json',
                text: JSON.stringify(e.request.body),
              };
            }
            const response = {
              status: e.response.statusCode,
              statusText: '',
              httpVersion: 'HTTP/1.1',
              cookies: [],
              headers: Object.entries(e.response.headers || {}).map(([name, value]) => ({ name, value })),
              content: {
                size: e.response.size,
                mimeType: e.response.headers?.['content-type'] || 'application/octet-stream',
              },
              redirectURL: '',
              headersSize: -1,
              bodySize: e.response.size,
            };
            if (full && e.response.body) {
              response.content.text = typeof e.response.body === 'string' ? e.response.body : JSON.stringify(e.response.body);
            }
            const timings = {
              blocked: -1,
              dns: -1,
              connect: -1,
              send: 0,
              wait: e.timing.headersReceived,
              receive: e.timing.bodyComplete - e.timing.headersReceived,
              ssl: -1,
              comment: '',
            };
            return {
              pageref: 'page_1',
              startedDateTime,
              time: e.duration,
              request,
              response,
              cache: {},
              timings,
            };
          }),
        },
      };
      return full ? har : { log: { version: '1.2', creator: har.log.creator, entries: har.log.entries.map(e => ({
        startedDateTime: e.startedDateTime,
        time: e.time,
        request: { method: e.request.method, url: e.request.url, headers: e.request.headers },
        response: { status: e.response.status, headers: e.response.headers, content: { size: e.response.content.size, mimeType: e.response.content.mimeType } },
        timings: e.timings,
      })) } };
    }

    function downloadHAR(har, filename) {
      const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    // ===== UI state =====
    const list = document.getElementById('list');
    const detail = document.getElementById('detail');
    const search = document.getElementById('search');
    const status = document.getElementById('status');
    const entryCounter = document.getElementById('entry-counter');
    const btnPause = document.getElementById('btn-pause');
    const btnClear = document.getElementById('btn-clear');
    const btnHarExport = document.getElementById('btn-har-export');
    const harDropdown = document.getElementById('har-dropdown');

    let entries = [];
    let filteredEntries = [];
    let selectedId = null;
    let paused = false;
    let filterPredicates = [];

    // Filter input elements
    const filterMethod = document.getElementById('filter-method');
    const filterStatus = document.getElementById('filter-status');
    const filterDuration = document.getElementById('filter-duration');
    const filterSize = document.getElementById('filter-size');
    const filterDateRange = document.getElementById('filter-date-range');

    // ===== Debounce utility =====
    function debounce(fn, ms) {
      let timer = 0;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
      };
    }

    // ===== Filter compilation =====
    function compileFilters() {
      const method = Array.from(filterMethod.selectedOptions).map(o => o.value);
      const status = Array.from(filterStatus.selectedOptions).map(o => o.value);
      const duration = filterDuration.value.trim();
      const size = filterSize.value.trim();
      let dateRange = {};

      const dr = filterDateRange.value;
      const now = Date.now();
      if (dr === '5m') dateRange = { start: now - 5 * 60 * 1000 };
      else if (dr === '15m') dateRange = { start: now - 15 * 60 * 1000 };
      else if (dr === '1h') dateRange = { start: now - 60 * 60 * 1000 };
      else if (dr === '6h') dateRange = { start: now - 6 * 60 * 60 * 1000 };
      else if (dr === '24h') dateRange = { start: now - 24 * 60 * 60 * 1000 };
      // 'custom' would need a date picker; for now treat as no filter

      filterPredicates = parseFilters({
        method: method.length ? method : undefined,
        status: status.length ? status : undefined,
        duration: duration || undefined,
        size: size || undefined,
        dateRange: Object.keys(dateRange).length ? dateRange : undefined,
      });
      applyFilterAndRender();
    }

    const debouncedCompile = debounce(compileFilters, 150);

    function applyFilterAndRender() {
      filteredEntries = entries.filter(e => applyFilters(e, filterPredicates));
      renderList();
      updateCounter();
    }

    function updateCounter() {
      entryCounter.textContent = filteredEntries.length + ' of ' + entries.length + ' entries';
    }

    // ===== Event listeners for filters =====
    filterMethod.addEventListener('change', debouncedCompile);
    filterStatus.addEventListener('change', debouncedCompile);
    filterDuration.addEventListener('input', debouncedCompile);
    filterSize.addEventListener('input', debouncedCompile);
    filterDateRange.addEventListener('change', debouncedCompile);

    // ===== HAR export dropdown =====
    btnHarExport.addEventListener('click', (e) => {
      e.stopPropagation();
      harDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => harDropdown.classList.remove('open'));
    harDropdown.querySelectorAll('button[data-har-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.harType;
        const har = generateHAR(filteredEntries, type === 'full');
        const filename = 'http-debugger-' + (type === 'full' ? 'full' : 'minimal') + '-' + Date.now() + '.har';
        downloadHAR(har, filename);
        harDropdown.classList.remove('open');
      });
    });

    // ===== Pause/Resume =====
    btnPause.addEventListener('click', () => {
      paused = !paused;
      btnPause.textContent = paused ? 'Resume' : 'Pause';
      btnPause.classList.toggle('paused', paused);
      status.textContent = paused ? 'Paused' : 'Connected';
      status.className = 'status ' + (paused ? 'paused' : 'connected');
    });

    // ===== Clear =====
    btnClear.addEventListener('click', () => {
      entries = [];
      filteredEntries = [];
      selectedId = null;
      detail.classList.remove('open');
      renderList();
      updateCounter();
    });

    // ===== Render =====
    function renderList() {
      const q = search.value.toLowerCase();
      const searchFiltered = filteredEntries.filter(e => {
        if (!q) return true;
        return e.request.method.toLowerCase().includes(q)
          || e.request.path.toLowerCase().includes(q)
          || String(e.response.statusCode).includes(q);
      });
      list.innerHTML = searchFiltered.map(e => {
        const sc = e.response.statusCode;
        const scClass = sc < 300 ? 's2xx' : sc < 400 ? 's3xx' : sc < 500 ? 's4xx' : 's5xx';
        return '<div class="entry' + (e.id === selectedId ? ' selected' : '') + '" data-id="' + e.id + '">'
          + '<span class="method ' + e.request.method + '">' + e.request.method + '</span>'
          + '<span class="path">' + e.request.path + '</span>'
          + '<span class="status-code ' + scClass + '">' + sc + '</span>'
          + '<span class="duration">' + e.duration.toFixed(1) + 'ms</span>'
          + '</div>';
      }).join('');
      list.querySelectorAll('.entry').forEach(el => {
        el.onclick = () => selectEntry(el.dataset.id);
      });
    }

    function selectEntry(id) {
      selectedId = id;
      const e = entries.find(x => x.id === id);
      if (!e) { detail.classList.remove('open'); return; }
      detail.classList.add('open');
      detail.innerHTML = '<div class="section"><h3>Request</h3><pre>'
        + e.request.method + ' ' + e.request.path + '\\n'
        + Object.entries(e.request.headers || {}).map(([k,v]) => k + ': ' + v).join('\\n')
        + (e.request.body ? '\\n\\n' + JSON.stringify(e.request.body, null, 2) : '')
        + '</pre></div>'
        + '<div class="section"><h3>Response</h3><pre>'
        + e.response.statusCode + '\\n'
        + Object.entries(e.response.headers || {}).map(([k,v]) => k + ': ' + v).join('\\n')
        + (e.response.body ? '\\n\\n' + JSON.stringify(e.response.body, null, 2) : '')
        + '</pre></div>'
        + '<div class="section"><h3>Timing</h3><div class="timing">'
        + '<div class="item"><div class="label">Headers</div><div class="value">' + e.timing.headersReceived.toFixed(1) + 'ms</div></div>'
        + '<div class="item"><div class="label">Body Read</div><div class="value">' + (e.timing.bodyComplete - e.timing.headersReceived).toFixed(1) + 'ms</div></div>'
        + '<div class="item"><div class="label">Handler</div><div class="value">' + (e.timing.handlerEnd - e.timing.handlerStart).toFixed(1) + 'ms</div></div>'
        + '<div class="item"><div class="label">Response</div><div class="value">' + (e.timing.responseEnd - e.timing.responseStart).toFixed(1) + 'ms</div></div>'
        + '</div></div>';
      renderList();
    }

    search.oninput = () => {
      renderList();
    };

    // ===== SSE connection =====
    function connect() {
      const es = new EventSource('/__debugger/stream');
      es.onmessage = (e) => {
        if (paused) return;
        const entry = JSON.parse(e.data);
        const idx = entries.findIndex(x => x.id === entry.id);
        if (idx >= 0) entries[idx] = entry;
        else entries.push(entry);
        applyFilterAndRender();
        if (selectedId === entry.id) selectEntry(entry.id);
      };
      es.onopen = () => {
        status.textContent = paused ? 'Paused' : 'Connected';
        status.className = 'status ' + (paused ? 'paused' : 'connected');
      };
      es.onerror = () => {
        status.textContent = 'Disconnected';
        status.className = 'status disconnected';
      };
    }
    connect();

    // Initial compile
    compileFilters();
  </script>
</body>
</html>`;

export function createDashboardEngine(maxEntries: number = 100): {
  isEnabled: boolean;
  addEntry: (entry: DebugEntry) => void;
  addClientWithHistory: (sendFn: (chunk: string) => void) => () => void;
  getAllEntries: () => DebugEntry[];
  clear: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: boolean;
  setMaxEntries: (max: number) => void;
} {
  const buffer: DebugEntry[] = [];
  const clients = new Set<(chunk: string) => void>();
  let paused = false;

  const isProduction =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

  return {
    isEnabled: !isProduction,

    get isPaused(): boolean {
      return paused;
    },

    addEntry(entry: DebugEntry) {
      if (paused) return;
      if (buffer.length >= maxEntries) buffer.shift();
      buffer.push(entry);
      const payload = `data: ${JSON.stringify(entry)}\n\n`;
      clients.forEach((send) => send(payload));
    },

    addClientWithHistory(sendFn: (chunk: string) => void): () => void {
      const history = buffer.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
      sendFn(history);
      clients.add(sendFn);
      return () => clients.delete(sendFn);
    },

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

    setMaxEntries(max: number): void {
      if (max < 100) throw new Error('maxEntries min 100');
      if (max > 50000) throw new Error('maxEntries max 50000');
      maxEntries = max;
      while (buffer.length > maxEntries) buffer.shift();
    },
  };
}

export type DashboardEngine = ReturnType<typeof createDashboardEngine>;
