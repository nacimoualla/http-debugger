import { describe, it, expect, beforeEach } from 'vitest';
import { createDashboardEngine, DASHBOARD_HTML } from '../../src/core/dashboard.js';
import type { DebugEntry } from '../../src/types.js';

describe('DASHBOARD_HTML', () => {
  it('contains filter toolbar elements', () => {
    expect(DASHBOARD_HTML).toContain('id="filter-method"');
    expect(DASHBOARD_HTML).toContain('id="filter-status"');
    expect(DASHBOARD_HTML).toContain('id="filter-duration"');
    expect(DASHBOARD_HTML).toContain('id="filter-size"');
    expect(DASHBOARD_HTML).toContain('id="filter-date-range"');
    expect(DASHBOARD_HTML).toContain('id="btn-clear"');
    expect(DASHBOARD_HTML).toContain('id="btn-har-export"');
    expect(DASHBOARD_HTML).toContain('id="btn-pause"');
  });

  it('contains HAR export dropdown options', () => {
    expect(DASHBOARD_HTML).toContain('Full HAR');
    expect(DASHBOARD_HTML).toContain('Minimal HAR');
  });

  it('contains filter toolbar styles', () => {
    expect(DASHBOARD_HTML).toContain('.toolbar');
    expect(DASHBOARD_HTML).toContain('.filter-row');
    expect(DASHBOARD_HTML).toContain('.action-row');
    expect(DASHBOARD_HTML).toContain('.dropdown');
    expect(DASHBOARD_HTML).toContain('.dropdown-menu');
  });

  it('contains filter logic and HAR generation in script', () => {
    expect(DASHBOARD_HTML).toContain('parseFilters');
    expect(DASHBOARD_HTML).toContain('applyFilters');
    expect(DASHBOARD_HTML).toContain('generateHAR');
    expect(DASHBOARD_HTML).toContain('compileFilters');
    expect(DASHBOARD_HTML).toContain('debounce');
    expect(DASHBOARD_HTML).toContain('filteredEntries');
    expect(DASHBOARD_HTML).toContain('paused');
    expect(DASHBOARD_HTML).toContain('btn-pause');
    expect(DASHBOARD_HTML).toContain('btn-clear');
    expect(DASHBOARD_HTML).toContain('btn-har-export');
    expect(DASHBOARD_HTML).toContain('data-har-type');
    expect(DASHBOARD_HTML).toContain('entry-counter');
  });
});

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

describe('createDashboardEngine', () => {
  let engine: ReturnType<typeof createDashboardEngine>;

  beforeEach(() => {
    engine = createDashboardEngine(3);
  });

  it('creates engine with default maxEntries', () => {
    const defaultEngine = createDashboardEngine();
    expect(defaultEngine.isEnabled).toBe(true);
  });

  it('is disabled in production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const prodEngine = createDashboardEngine();
    expect(prodEngine.isEnabled).toBe(false);
    process.env.NODE_ENV = original;
  });

  it('adds entries to buffer', () => {
    const entry = { id: '1', request: { method: 'GET' }, response: { statusCode: 200 } } as any;
    engine.addEntry(entry);
    let received = '';
    engine.addClientWithHistory((chunk) => { received += chunk; });
    expect(received).toContain('"id":"1"');
  });

  it('shifts oldest entry when buffer is full', () => {
    const e1 = { id: '1' } as any;
    const e2 = { id: '2' } as any;
    const e3 = { id: '3' } as any;
    const e4 = { id: '4' } as any;
    engine.addEntry(e1);
    engine.addEntry(e2);
    engine.addEntry(e3);
    engine.addEntry(e4); // should shift e1
    let received = '';
    engine.addClientWithHistory((chunk) => { received += chunk; });
    expect(received).not.toContain('"id":"1"');
    expect(received).toContain('"id":"4"');
  });

  it('broadcasts to connected clients', () => {
    let received = '';
    engine.addClientWithHistory((chunk) => { received += chunk; });
    const entry = { id: '10' } as any;
    engine.addEntry(entry);
    expect(received).toContain('"id":"10"');
  });

  it('teardown removes client from set', () => {
    let callCount = 0;
    const sendFn = () => { callCount++; };
    const teardown = engine.addClientWithHistory(sendFn);
    engine.addEntry({ id: '1' } as any);
    expect(callCount).toBe(2); // history + broadcast
    teardown();
    callCount = 0;
    engine.addEntry({ id: '2' } as any);
    expect(callCount).toBe(0); // client removed
  });

  it('hydrates new client with historical entries', () => {
    engine.addEntry({ id: '1' } as any);
    engine.addEntry({ id: '2' } as any);
    let received = '';
    engine.addClientWithHistory((chunk) => { received += chunk; });
    expect(received).toContain('"id":"1"');
    expect(received).toContain('"id":"2"');
  });
});

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
    engine.setMaxEntries(100);
    // Add 150 entries (exceeds maxEntries=100 from createDashboardEngine(10) - wait, maxEntries is 10
    // Let's use a larger maxEntries to test eviction
    engine.setMaxEntries(150);
    for (let i = 1; i <= 200; i++) {
      engine.addEntry(createEntry({ id: String(i) }));
    }
    expect(engine.getAllEntries().length).toBe(150); // capped at 150

    // Reduce maxEntries to force eviction
    engine.setMaxEntries(100);
    const entries = engine.getAllEntries();
    expect(entries.length).toBe(100);
    // Oldest 100 entries should be evicted, so we should have entries 101-200
    expect(entries[0].id).toBe('101');
    expect(entries[99].id).toBe('200');
  });

  it('setMaxEntries throws on invalid values', () => {
    expect(() => engine.setMaxEntries(50)).toThrow('min 100');
    expect(() => engine.setMaxEntries(60000)).toThrow('max 50000');
  });

  it('setMaxEntries works at runtime with valid values', () => {
    engine.setMaxEntries(150);
    for (let i = 1; i <= 120; i++) {
      engine.addEntry(createEntry({ id: String(i) }));
    }
    expect(engine.getAllEntries().length).toBe(120);

    // Reduce maxEntries at runtime - should evict oldest
    engine.setMaxEntries(100);
    const entries = engine.getAllEntries();
    expect(entries.length).toBe(100);
    // Oldest 20 entries (1-20) should be evicted, keeping 21-120
    expect(entries[0].id).toBe('21');
    expect(entries[99].id).toBe('120');
  });
});
