import type { MiddlewareHandler } from 'hono';
import type { MiddlewareOptions, DebugEntry, DashboardAuthFn } from '../types.js';
import { createTiming } from '../core/timing.js';
import { generateId } from '../core/capture.js';
import { formatEntry } from '../core/formatter.js';
import { createDashboardEngine, DASHBOARD_HTML } from '../core/dashboard.js';

export const isTTY = (() => {
  try {
    return (
      typeof process !== 'undefined' && process.stdout != null && process.stdout.isTTY === true
    );
  } catch {
    return false;
  }
})();

export async function readBodyWithLimit(
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
  const engine = createDashboardEngine(
    typeof options.dashboard === 'object' ? options.dashboard.maxEntries : undefined,
  );
  const dashboardAuth: DashboardAuthFn | undefined =
    typeof options.dashboard === 'object' ? options.dashboard.auth : undefined;

  return async (c, next) => {
    const timing = createTiming();
    const id = generateId();

    timing.markHeadersReceived();

    if (engine.isEnabled) {
      const path = c.req.path;
      if (path === '/__debugger' || path === '/__debugger/stream') {
        if (dashboardAuth) {
          const allowed = await dashboardAuth(c.req.raw);
          if (!allowed) {
            return c.text('Forbidden', 403);
          }
        }
        if (path === '/__debugger') {
          return c.html(DASHBOARD_HTML);
        }
        if (path === '/__debugger/stream') {
          let teardown: (() => void) | undefined;
          const stream = new ReadableStream({
            start(controller) {
              const sendFn = (chunk: string) => {
                controller.enqueue(new TextEncoder().encode(chunk));
              };
              teardown = engine.addClientWithHistory(sendFn);
            },
            cancel() {
              teardown?.();
            },
          });
          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          });
        }
      }
    }

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

    if (engine.isEnabled) {
      engine.addEntry(entry);
    }
  };
}

export default httpDebugger;
