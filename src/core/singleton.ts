import { createDashboardEngine, type DashboardEngine } from './dashboard.js';
import type { MiddlewareOptions } from '../types.js';

const globalForDebugger = globalThis as unknown as {
  __httpDebuggerEngine: DashboardEngine | undefined;
  __httpDebuggerOptions: MiddlewareOptions | undefined;
};

export const engine: DashboardEngine =
  globalForDebugger.__httpDebuggerEngine ?? createDashboardEngine();

if (process.env.NODE_ENV !== 'production') {
  globalForDebugger.__httpDebuggerEngine = engine;
}

export function setDashboardOptions(options: MiddlewareOptions): void {
  const globalForOptions = globalThis as unknown as {
    __httpDebuggerOptions: MiddlewareOptions | undefined;
  };
  if (process.env.NODE_ENV !== 'production') {
    globalForOptions.__httpDebuggerOptions = options;
  }
}

export function getDashboardOptions(): MiddlewareOptions {
  const globalForOptions = globalThis as unknown as {
    __httpDebuggerOptions: MiddlewareOptions | undefined;
  };
  return globalForOptions.__httpDebuggerOptions ?? {};
}
