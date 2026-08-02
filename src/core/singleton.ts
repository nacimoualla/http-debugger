import { createDashboardEngine, type DashboardEngine } from './dashboard.js';
import type { DashboardOptions } from '../types.js';

const globalForDebugger = globalThis as unknown as {
  __httpDebuggerEngine: DashboardEngine | undefined;
  __httpDebuggerOptions: DashboardOptions | undefined;
};

export const engine: DashboardEngine = globalForDebugger.__httpDebuggerEngine ?? createDashboardEngine();

if (process.env.NODE_ENV !== 'production') {
  globalForDebugger.__httpDebuggerEngine = engine;
}

export function setDashboardOptions(options: DashboardOptions): void {
  const globalForOptions = globalThis as unknown as {
    __httpDebuggerOptions: DashboardOptions | undefined;
  };
  if (process.env.NODE_ENV !== 'production') {
    globalForOptions.__httpDebuggerOptions = options;
  } else {
    console.warn('setDashboardOptions is ignored in production');
  }
}

export function getDashboardOptions(): DashboardOptions {
  const globalForOptions = globalThis as unknown as {
    __httpDebuggerOptions: DashboardOptions | undefined;
  };
  return globalForOptions.__httpDebuggerOptions ?? {};
}
