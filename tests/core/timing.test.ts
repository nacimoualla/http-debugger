import { describe, it, expect } from 'vitest';
import { createTiming } from '../../src/core/timing.js';

describe('createTiming', () => {
  it('records headers received relative to start', () => {
    const timing = createTiming();
    timing.markHeadersReceived();
    const json = timing.toJSON();
    expect(json.headersReceived).toBeGreaterThanOrEqual(0);
    expect(json.headersReceived).toBeLessThan(100);
  });

  it('records body complete relative to start', () => {
    const timing = createTiming();
    timing.markHeadersReceived();
    timing.markBodyComplete();
    const json = timing.toJSON();
    expect(json.bodyComplete).toBeGreaterThanOrEqual(json.headersReceived);
  });

  it('records handler start and end relative to start', () => {
    const timing = createTiming();
    timing.markHandlerStart();
    timing.markHandlerEnd();
    const json = timing.toJSON();
    expect(json.handlerEnd).toBeGreaterThanOrEqual(json.handlerStart);
  });

  it('records response start and end relative to start', () => {
    const timing = createTiming();
    timing.markResponseStart();
    timing.markResponseEnd();
    const json = timing.toJSON();
    expect(json.responseEnd).toBeGreaterThanOrEqual(json.responseStart);
  });

  it('calculates duration from start to response end', () => {
    const timing = createTiming();
    timing.markResponseEnd();
    expect(timing.duration).toBeGreaterThanOrEqual(0);
    expect(timing.duration).toBeLessThan(100);
  });

  it('returns complete TimingInfo without start field', () => {
    const timing = createTiming();
    timing.markHeadersReceived();
    timing.markBodyComplete();
    timing.markHandlerStart();
    timing.markHandlerEnd();
    timing.markResponseStart();
    timing.markResponseEnd();

    const info = timing.toJSON();
    expect(info).not.toHaveProperty('start');
    expect(info).toHaveProperty('headersReceived');
    expect(info).toHaveProperty('bodyComplete');
    expect(info).toHaveProperty('handlerStart');
    expect(info).toHaveProperty('handlerEnd');
    expect(info).toHaveProperty('responseStart');
    expect(info).toHaveProperty('responseEnd');
  });

  it('produces monotonically increasing values', () => {
    const timing = createTiming();
    timing.markHeadersReceived();
    timing.markBodyComplete();
    timing.markHandlerStart();
    timing.markHandlerEnd();
    timing.markResponseStart();
    timing.markResponseEnd();

    const info = timing.toJSON();
    expect(info.headersReceived).toBeGreaterThanOrEqual(0);
    expect(info.bodyComplete).toBeGreaterThanOrEqual(info.headersReceived);
    expect(info.handlerStart).toBeGreaterThanOrEqual(info.bodyComplete);
    expect(info.handlerEnd).toBeGreaterThanOrEqual(info.handlerStart);
    expect(info.responseStart).toBeGreaterThanOrEqual(info.handlerEnd);
    expect(info.responseEnd).toBeGreaterThanOrEqual(info.responseStart);
  });
});
