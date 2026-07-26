import type { TimingInfo } from '../types.js';

export interface Timing {
  start: number;
  headersReceived: number;
  bodyComplete: number;
  handlerStart: number;
  handlerEnd: number;
  responseStart: number;
  responseEnd: number;
  duration: number;
  markHeadersReceived(): void;
  markBodyComplete(): void;
  markHandlerStart(): void;
  markHandlerEnd(): void;
  markResponseStart(): void;
  markResponseEnd(): void;
  toJSON(): TimingInfo;
}

export function createTiming(): Timing {
  const now = () => Date.now();
  let headersReceived = 0;
  let bodyComplete = 0;
  let handlerStart = 0;
  let handlerEnd = 0;
  let responseStart = 0;
  let responseEnd = 0;

  const timing: Timing = {
    start: now(),
    get headersReceived() { return headersReceived; },
    get bodyComplete() { return bodyComplete; },
    get handlerStart() { return handlerStart; },
    get handlerEnd() { return handlerEnd; },
    get responseStart() { return responseStart; },
    get responseEnd() { return responseEnd; },
    get duration() { return responseEnd > 0 ? responseEnd - timing.start : 0; },
    markHeadersReceived() { headersReceived = now(); },
    markBodyComplete() { bodyComplete = now(); },
    markHandlerStart() { handlerStart = now(); },
    markHandlerEnd() { handlerEnd = now(); },
    markResponseStart() { responseStart = now(); },
    markResponseEnd() { responseEnd = now(); },
    toJSON(): TimingInfo {
      return {
        start: timing.start,
        headersReceived,
        bodyComplete,
        handlerStart,
        handlerEnd,
        responseStart,
        responseEnd,
      };
    },
  };

  return timing;
}
