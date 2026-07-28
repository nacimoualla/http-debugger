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
    .search { padding: 12px 24px; border-bottom: 1px solid #21262d; }
    .search input { width: 100%; padding: 8px 12px; background: #161b22; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font-size: 14px; }
    .search input:focus { outline: none; border-color: #58a6ff; }
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
  <div class="list" id="list"></div>
  <div class="detail" id="detail"></div>
  <script>
    const list = document.getElementById('list');
    const detail = document.getElementById('detail');
    const search = document.getElementById('search');
    const status = document.getElementById('status');
    let entries = [];
    let selectedId = null;

    function renderList() {
      const q = search.value.toLowerCase();
      const filtered = entries.filter(e => {
        if (!q) return true;
        return e.request.method.toLowerCase().includes(q)
          || e.request.path.toLowerCase().includes(q)
          || String(e.response.statusCode).includes(q);
      });
      list.innerHTML = filtered.map(e => {
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

    search.oninput = renderList;

    function connect() {
      const es = new EventSource('/__debugger/stream');
      es.onmessage = (e) => {
        const entry = JSON.parse(e.data);
        const idx = entries.findIndex(x => x.id === entry.id);
        if (idx >= 0) entries[idx] = entry;
        else entries.push(entry);
        renderList();
        if (selectedId === entry.id) selectEntry(entry.id);
      };
      es.onopen = () => {
        status.textContent = 'Connected';
        status.className = 'status connected';
      };
      es.onerror = () => {
        status.textContent = 'Disconnected';
        status.className = 'status disconnected';
      };
    }
    connect();
  </script>
</body>
</html>`;

export function createDashboardEngine(maxEntries: number = 100): {
  isEnabled: boolean;
  addEntry: (entry: DebugEntry) => void;
  addClientWithHistory: (sendFn: (chunk: string) => void) => () => void;
} {
  const buffer: DebugEntry[] = [];
  const clients = new Set<(chunk: string) => void>();

  const isProduction =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

  return {
    isEnabled: !isProduction,

    addEntry(entry: DebugEntry) {
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
  };
}
