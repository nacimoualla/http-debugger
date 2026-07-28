import type { MiddlewareHandler } from 'hono';
import type { MiddlewareOptions, DebugEntry } from '../types.js';
import { createTiming } from '../core/timing.js';
import { generateId } from '../core/capture.js';
import { formatEntry } from '../core/formatter.js';

const isTTY = (() => {
  try {
    return (
      typeof process !== 'undefined' && process.stdout != null && process.stdout.isTTY === true
    );
  } catch {
    return false;
  }
})();

async function readBodyWithLimit(
  stream: ReadableStream | null,
  maxBodySize: number,
): Promise<{ body: string; truncated: boolean }> {
  if (!stream) return { body: '', truncated: false };

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.length;
    if (totalBytes <= maxBodySize) {
      chunks.push(value);
    } else {
      const remaining = maxBodySize - chunks.reduce((acc, c) => acc + c.length, 0);
      if (remaining > 0) {
        chunks.push(value.subarray(0, remaining));
      }
      truncated = true;
      reader.cancel();
      break;
    }
  }

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  const decoder = new TextDecoder();
  return { body: decoder.decode(combined), truncated };
}

export function httpDebugger(options: MiddlewareOptions = {}): MiddlewareHandler {
  const maxBodySize = options.maxBodySize ?? 1024;
  const useColors = options.colors !== undefined ? options.colors : isTTY;

  return async (c, next) => {
    const timing = createTiming();
    const id = generateId();

    timing.markHeadersReceived();

    const reqClone = c.req.raw.clone();
    const { body: reqBodyStr, truncated: reqTruncated } = await readBodyWithLimit(
      reqClone.body,
      maxBodySize,
    );

    let reqBody: unknown = null;
    if (reqBodyStr) {
      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          reqBody = JSON.parse(reqBodyStr);
        } catch {
          reqBody = '[parse error: invalid JSON]';
        }
      } else {
        reqBody = reqBodyStr;
      }
    }

    timing.markBodyComplete();
    timing.markHandlerStart();

    await next();

    timing.markHandlerEnd();
    timing.markResponseStart();

    const resClone = c.res.clone();
    const { body: resBodyStr, truncated: resTruncated } = await readBodyWithLimit(
      resClone.body,
      maxBodySize,
    );

    let resBody: unknown = null;
    if (resBodyStr) {
      try {
        resBody = JSON.parse(resBodyStr);
      } catch {
        resBody = resBodyStr;
      }
    }

    timing.markResponseEnd();

    const entry: DebugEntry = {
      id,
      timestamp: Date.now(),
      request: {
        method: c.req.method,
        path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers.entries()) as Record<string, string>,
        body: reqTruncated ? null : reqBody,
        bodyTruncated: reqTruncated,
        query: Object.fromEntries(new URL(c.req.url).searchParams),
        params: {},
      },
      response: {
        statusCode: c.res.status,
        headers: Object.fromEntries(c.res.headers.entries()) as Record<string, string>,
        body: resTruncated ? null : resBody,
        bodyTruncated: resTruncated,
        size: resBodyStr ? Buffer.byteLength(resBodyStr) : 0,
      },
      timing: timing.toJSON(),
      duration: timing.duration,
    };

    if (options.filter && !options.filter(entry)) return;

    console.log(
      formatEntry(entry, {
        colors: useColors,
        sanitize: options.sanitize,
        maxDepth: options.maxDepth,
        maxArrayItems: options.maxArrayItems,
        curl: options.curl,
      }),
    );
  };
}

export default httpDebugger;
