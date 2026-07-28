import { describe, it, expect, beforeEach } from 'vitest';
import { createDashboardEngine } from '../../src/core/dashboard.js';

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
