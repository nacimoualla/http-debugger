import { describe, it, expect } from 'vitest';
import { createTiming } from '../../src/core/timing.js';

describe('createTiming', () => {
  it('creates timing with start time set', () => {
    const timing = createTiming();
    expect(timing.start).toBeGreaterThan(0);
    expect(typeof timing.start).toBe('number');
  });

  it('records headers received', () => {
    const timing = createTiming();
    timing.markHeadersReceived();
    expect(timing.headersReceived).toBeGreaterThanOrEqual(timing.start);
  });

  it('records body complete', () => {
    const timing = createTiming();
    timing.markHeadersReceived();
    timing.markBodyComplete();
    expect(timing.bodyComplete).toBeGreaterThanOrEqual(timing.headersReceived);
  });

  it('records handler start and end', () => {
    const timing = createTiming();
    timing.markHandlerStart();
    timing.markHandlerEnd();
    expect(timing.handlerEnd).toBeGreaterThanOrEqual(timing.handlerStart);
  });

  it('records response start and end', () => {
    const timing = createTiming();
    timing.markResponseStart();
    timing.markResponseEnd();
    expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
  });

  it('calculates duration from start to response end', () => {
    const timing = createTiming();
    timing.markResponseEnd();
    expect(timing.duration).toBeGreaterThanOrEqual(0);
  });

  it('returns complete TimingInfo', () => {
    const timing = createTiming();
    timing.markHeadersReceived();
    timing.markBodyComplete();
    timing.markHandlerStart();
    timing.markHandlerEnd();
    timing.markResponseStart();
    timing.markResponseEnd();

    const info = timing.toJSON();
    expect(info).toHaveProperty('start');
    expect(info).toHaveProperty('headersReceived');
    expect(info).toHaveProperty('bodyComplete');
    expect(info).toHaveProperty('handlerStart');
    expect(info).toHaveProperty('handlerEnd');
    expect(info).toHaveProperty('responseStart');
    expect(info).toHaveProperty('responseEnd');
  });
});
