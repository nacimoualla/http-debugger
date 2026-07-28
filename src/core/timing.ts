import type { TimingInfo } from '../types.js';

export interface Timing {
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
