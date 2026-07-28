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
    engine.addEntry(createEntry({ id: '1' }));
    engine.addEntry(createEntry({ id: '2' }));
    engine.addEntry(createEntry({ id: '3' }));
    engine.addEntry(createEntry({ id: '4' }));
    engine.addEntry(createEntry({ id: '5' }));
    engine.setMaxEntries(100); // no change
    expect(engine.getAllEntries().length).toBe(5);
    expect(() => engine.setMaxEntries(3)).toThrow('min 100');
  });

  it('setMaxEntries throws on invalid values', () => {
    expect(() => engine.setMaxEntries(50)).toThrow('min 100');
    expect(() => engine.setMaxEntries(60000)).toThrow('max 50000');
  });

  it('setMaxEntries works at runtime with valid values', () => {
    engine.setMaxEntries(100);
    engine.addEntry(createEntry({ id: '1' }));
    engine.addEntry(createEntry({ id: '2' }));
    engine.addEntry(createEntry({ id: '3' }));
    engine.setMaxEntries(100);
    expect(engine.getAllEntries().length).toBe(3);
  });
});
