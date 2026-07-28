export type {
  /** High-resolution timing data for a single HTTP request lifecycle. */
  TimingInfo,
  /** Captured request data for a single HTTP request. */
  RequestCapture,
  /** Captured response data for a single HTTP response. */
  ResponseCapture,
  /** Complete debug entry for a single HTTP request/response cycle. */
  DebugEntry,
  /** Configuration options for the http-debugger middleware. */
  MiddlewareOptions,
} from './types.js';

export { createTiming } from './core/timing.js';
export {
  generateId,
  captureRequestBody,
  captureResponseBody,
} from './core/capture.js';
export type { CaptureResult } from './core/capture.js';
export { formatEntry } from './core/formatter.js';
export { sanitizeHeaders } from './core/sanitize.js';
export { createDashboardEngine, DASHBOARD_HTML } from './core/dashboard.js';
export { withHttpDebugger, dashboardRoute } from './next.js';
export type { DashboardOptions } from './types.js';
