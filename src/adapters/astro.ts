import type { APIContext, MiddlewareNext } from 'astro';
import type { MiddlewareOptions, DebugEntry, DashboardAuthFn } from '../types.js';
import { createTiming } from '../core/timing.js';
import { generateId } from '../core/capture.js';
import { formatEntry } from '../core/formatter.js';
import { createDashboardEngine, DASHBOARD_HTML } from '../core/dashboard.js';
import { readBodyWithLimit } from '../core/stream.js';

const isTTY = (() => {
  try {
    return (
      typeof process !== 'undefined' && process.stdout != null && process.stdout.isTTY === true
    );
  } catch {
    return false;
  }
})();

export function httpDebugger(options: MiddlewareOptions = {}) {
  const maxBodySize = options.maxBodySize ?? 1024;
  const useColors = options.colors !== undefined ? options.colors : isTTY;
  const engine = createDashboardEngine(
    typeof options.dashboard === 'object' ? options.dashboard.maxEntries : undefined,
  );
  const dashboardAuth: DashboardAuthFn | undefined =
    typeof options.dashboard === 'object' ? options.dashboard.auth : undefined;

  return async (context: APIContext, next: MiddlewareNext): Promise<Response> => {
    const timing = createTiming();
    const id = generateId();

    timing.markHeadersReceived();

    if (engine.isEnabled) {
      const pathname = context.url.pathname;
      if (pathname === '/__debugger' || pathname === '/__debugger/stream') {
        if (dashboardAuth) {
          const allowed = await dashboardAuth(context.request);
          if (!allowed) {
            return new Response('Forbidden', { status: 403 });
          }
        }
        if (pathname === '/__debugger') {
          return new Response(DASHBOARD_HTML, {
            headers: { 'Content-Type': 'text/html' },
          });
        }
        if (pathname === '/__debugger/stream') {
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

    const reqClone = context.request.clone();
    const { body: reqBodyStr, truncated: reqTruncated } = await readBodyWithLimit(
      reqClone.body,
      maxBodySize,
    );

    let reqBody: unknown = null;
    if (reqBodyStr) {
      const contentType = context.request.headers.get('content-type') || '';
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

    const response = await next();

    timing.markHandlerEnd();
    timing.markResponseStart();

    const resClone = response.clone();
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
        method: context.request.method,
        path: context.url.pathname,
        headers: Object.fromEntries(context.request.headers.entries()) as Record<string, string>,
        body: reqTruncated ? null : reqBody,
        bodyTruncated: reqTruncated,
        query: Object.fromEntries(context.url.searchParams),
        params: context.params as Record<string, string>,
      },
      response: {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()) as Record<string, string>,
        body: resTruncated ? null : resBody,
        bodyTruncated: resTruncated,
        size: resBodyStr ? Buffer.byteLength(resBodyStr) : 0,
      },
      timing: timing.toJSON(),
      duration: timing.duration,
    };

    if (options.filter && !options.filter(entry)) return response;

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

    return response;
  };
}

export default httpDebugger;
