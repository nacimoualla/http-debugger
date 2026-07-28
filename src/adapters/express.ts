import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { MiddlewareOptions } from '../types.js';
import { createTiming } from '../core/timing.js';
import { generateId, captureRequestBody, captureResponseBody } from '../core/capture.js';
import { formatEntry } from '../core/formatter.js';

export function httpDebugger(options: MiddlewareOptions = {}): RequestHandler {
  const maxBodySize = options.maxBodySize ?? 1024;

  return (req: Request, res: Response, next: NextFunction): void => {
    const timing = createTiming();
    const id = generateId();

    timing.markHeadersReceived();

    const requestChunks: Buffer[] = [];
    let requestBytesCollected = 0;
    let requestOverflow = false;
    const originalReqOn = req.on.bind(req);

    req.on = function (event: string, listener: (...args: unknown[]) => void) {
      if (event === 'data') {
        return originalReqOn(event, (chunk: Buffer) => {
          listener(chunk);
        });
      }
      if (event === 'end') {
        return originalReqOn(event, function (this: Request, ...args: unknown[]) {
          timing.markBodyComplete();
          return listener.apply(this, args);
        });
      }
      return originalReqOn(event, listener);
    } as typeof req.on;

    originalReqOn('data', (chunk: Buffer) => {
      if (!requestOverflow) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (requestBytesCollected + buf.length <= maxBodySize) {
          requestChunks.push(buf);
          requestBytesCollected += buf.length;
        } else {
          const remaining = maxBodySize - requestBytesCollected;
          if (remaining > 0) {
            requestChunks.push(buf.subarray(0, remaining));
          }
          requestOverflow = true;
        }
      }
    });

    originalReqOn('end', () => {
      timing.markBodyComplete();
    });

    const responseChunks: Buffer[] = [];
    let responseBytesCollected = 0;
    let totalResponseBytes = 0;
    let responseOverflow = false;
    let responseStarted = false;
    let responseFinished = false;

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = function (chunk: Buffer | string | Uint8Array, ...args: unknown[]) {
      if (!responseStarted) {
        responseStarted = true;
        timing.markResponseStart();
      }
      if (chunk) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalResponseBytes += buf.length;
        if (!responseOverflow) {
          if (responseBytesCollected + buf.length <= maxBodySize) {
            responseChunks.push(buf);
            responseBytesCollected += buf.length;
          } else {
            const remaining = maxBodySize - responseBytesCollected;
            if (remaining > 0) {
              responseChunks.push(buf.subarray(0, remaining));
            }
            responseOverflow = true;
          }
        }
      }
      return originalWrite(chunk, ...(args as []));
    } as typeof res.write;

    res.end = function (chunk?: Buffer | string | Uint8Array, ...args: unknown[]) {
      if (!responseStarted && chunk) {
        responseStarted = true;
        timing.markResponseStart();
      }
      if (chunk) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalResponseBytes += buf.length;
        if (!responseOverflow) {
          if (responseBytesCollected + buf.length <= maxBodySize) {
            responseChunks.push(buf);
            responseBytesCollected += buf.length;
          } else {
            const remaining = maxBodySize - responseBytesCollected;
            if (remaining > 0) {
              responseChunks.push(buf.subarray(0, remaining));
            }
            responseOverflow = true;
          }
        }
      }
      return originalEnd(chunk, ...(args as []));
    } as typeof res.end;

    res.on('finish', () => {
      if (responseFinished) return;
      responseFinished = true;

      timing.markResponseEnd();

      const reqCapture = captureRequestBody(
        requestChunks,
        req.headers['content-type'] || '',
        maxBodySize,
      );
      const resCapture = captureResponseBody(responseChunks, maxBodySize);

      const entry = {
        id,
        timestamp: Date.now(),
        request: {
          method: req.method,
          path: req.originalUrl || req.url,
          headers: req.headers as Record<string, string>,
          body: reqCapture.body,
          bodyTruncated: requestOverflow || reqCapture.truncated,
          query: req.query as Record<string, string>,
          params: req.params as Record<string, string>,
        },
        response: {
          statusCode: res.statusCode,
          headers: res.getHeaders() as Record<string, string>,
          body: resCapture.body,
          bodyTruncated: responseOverflow || resCapture.truncated,
          size: parseInt(res.getHeader('content-length') as string) || totalResponseBytes,
        },
        timing: timing.toJSON(),
        duration: timing.duration,
      };

      if (options.filter && !options.filter(entry)) return;

      console.log(
        formatEntry(entry, {
          colors: options.colors,
          sanitize: options.sanitize,
          maxDepth: options.maxDepth,
          maxArrayItems: options.maxArrayItems,
          curl: options.curl,
        }),
      );
    });

    next();
  };
}

export default httpDebugger;
