import { describe, it, expect, afterEach } from 'vitest';
import { engine, setDashboardOptions, getDashboardOptions } from '../../src/core/singleton.js';
import type { MiddlewareOptions } from '../../src/types.js';

describe('singleton engine', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    // Clear any options set during test
    const globalForOptions = globalThis as unknown as {
      __httpDebuggerOptions: MiddlewareOptions | undefined;
    };
    globalForOptions.__httpDebuggerOptions = undefined;
  });

  it('exports a valid engine', () => {
    expect(engine).toBeDefined();
    expect(typeof engine.addEntry).toBe('function');
    expect(typeof engine.addClientWithHistory).toBe('function');
    expect(typeof engine.isEnabled).toBe('boolean');
  });

  it('preserves same engine instance across imports', () => {
    const engine1 = engine;
    const engine2 = engine;
    expect(engine1).toBe(engine2);
  });

  it('stores and retrieves dashboard options', () => {
    setDashboardOptions({ maxDepth: 6, sanitize: false });
    const opts = getDashboardOptions();
    expect(opts.maxDepth).toBe(6);
    expect(opts.sanitize).toBe(false);
  });

  it('returns empty object when no options set', () => {
    const opts = getDashboardOptions();
    expect(opts).toEqual({});
  });
});
