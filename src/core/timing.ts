import type { TimingInfo } from '../types.js';

/** High-resolution timer for tracking HTTP request lifecycle phases. */
export interface Timing {
  /** Time in ms from request start to when headers were received. */
  headersReceived: number;
  /** Time in ms from request start to when the request body was fully read. */
  bodyComplete: number;
  /** Time in ms from request start to when the route handler began executing. */
  handlerStart: number;
  /** Time in ms from request start to when the route handler finished executing. */
  handlerEnd: number;
  /** Time in ms from request start to when the response body started being written. */
  responseStart: number;
  /** Time in ms from request start to when the response was fully sent. */
  responseEnd: number;
  /** Total request duration in ms. */
  duration: number;
  /** Mark the point when request headers were received. */
  markHeadersReceived(): void;
  /** Mark the point when the request body was fully read. */
  markBodyComplete(): void;
  /** Mark the point when the route handler started. */
  markHandlerStart(): void;
  /** Mark the point when the route handler finished. */
  markHandlerEnd(): void;
  /** Mark the point when the response body started being written. */
  markResponseStart(): void;
  /** Mark the point when the response was fully sent. */
  markResponseEnd(): void;
  /** Serialize timing data to a plain object. */
  toJSON(): TimingInfo;
}

/**
 * Creates a high-resolution timer using `performance.now()`.
 * All timing values are relative to the moment this function is called.
 */
export function createTiming(): Timing {
  const start = performance.now();
  let headersReceived = 0;
  let bodyComplete = 0;
  let handlerStart = 0;
  let handlerEnd = 0;
  let responseStart = 0;
  let responseEnd = 0;

  const timing: Timing = {
    get headersReceived() {
      return headersReceived - start;
    },
    get bodyComplete() {
      return bodyComplete - start;
    },
    get handlerStart() {
      return handlerStart - start;
    },
    get handlerEnd() {
      return handlerEnd - start;
    },
    get responseStart() {
      return responseStart - start;
    },
    get responseEnd() {
      return responseEnd - start;
    },
    get duration() {
      return responseEnd > 0 ? responseEnd - start : 0;
    },
    markHeadersReceived() {
      headersReceived = performance.now();
    },
    markBodyComplete() {
      bodyComplete = performance.now();
    },
    markHandlerStart() {
      handlerStart = performance.now();
    },
    markHandlerEnd() {
      handlerEnd = performance.now();
    },
    markResponseStart() {
      responseStart = performance.now();
    },
    markResponseEnd() {
      responseEnd = performance.now();
    },
    toJSON(): TimingInfo {
      return {
        headersReceived: headersReceived - start,
        bodyComplete: bodyComplete - start,
        handlerStart: handlerStart - start,
        handlerEnd: handlerEnd - start,
        responseStart: responseStart - start,
        responseEnd: responseEnd - start,
      };
    },
  };

  return timing;
}
