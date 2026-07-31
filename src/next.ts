import type { MiddlewareOptions, DashboardOptions, DebugEntry, DashboardAuthFn } from './types.js';
import { engine, setDashboardOptions, getDashboardOptions } from './core/singleton.js';
import { readBodyWithLimit } from './core/stream.js';
import { createTiming } from './core/timing.js';
import { generateId } from './core/capture.js';
import { formatEntry } from './core/formatter.js';
import { DASHBOARD_HTML } from './core/dashboard.js';

export function dashboardRoute(
  options?: DashboardOptions,
): (req: Request) => Promise<Response> {
  if (options) {
    setDashboardOptions(options);
  }
  const dashboardAuth: DashboardAuthFn | undefined = options?.dashboard
    && typeof options.dashboard === 'object'
    ? options.dashboard.auth
    : undefined;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (dashboardAuth) {
      const allowed = await dashboardAuth(req);
      if (!allowed) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    if (path.endsWith('/stream')) {
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
          'Connection': 'keep-alive',
        },
      });
    }

    return new Response(DASHBOARD_HTML, {
      headers: { 'Content-Type': 'text/html' },
    });
  };
}

export function withHttpDebugger(
  handler: (req: Request) => Promise<Response> | Response,
  handlerOptions?: MiddlewareOptions,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (!engine.isEnabled) {
      return handler(req);
    }

    const timing = createTiming();
    const id = generateId();
    const maxBodySize = handlerOptions?.maxBodySize ?? 1024;

    timing.markHeadersReceived();

    const reqClone = req.clone();
    const { body: reqBodyStr, truncated: reqTruncated } = await readBodyWithLimit(
      reqClone.body,
      maxBodySize,
    );

    let reqBody: unknown = null;
    if (reqBodyStr) {
      const contentType = req.headers.get('content-type') || '';
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

    const res = await handler(req);

    timing.markHandlerEnd();

    const resClone = res.clone();

    // Fire and forget: process the clone in the background
    // This avoids blocking streaming responses (SSE, AI text streams, etc.)
    (async () => {
      timing.markResponseStart();

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
          method: req.method,
          path: new URL(req.url).pathname,
          headers: Object.fromEntries(req.headers.entries()) as Record<string, string>,
          body: reqTruncated ? null : reqBody,
          bodyTruncated: reqTruncated,
          query: Object.fromEntries(new URL(req.url).searchParams),
          params: {},
        },
        response: {
          statusCode: res.status,
          headers: Object.fromEntries(res.headers.entries()) as Record<string, string>,
          body: resTruncated ? null : resBody,
          bodyTruncated: resTruncated,
          size: resBodyStr ? Buffer.byteLength(resBodyStr) : 0,
        },
        timing: timing.toJSON(),
        duration: timing.duration,
      };

      const dashboardOpts = getDashboardOptions();
      const mergedOptions = { ...dashboardOpts, ...handlerOptions };

      if (mergedOptions.filter && !mergedOptions.filter(entry)) return;

      console.log(
        formatEntry(entry, {
          colors: mergedOptions.colors,
          sanitize: mergedOptions.sanitize,
          maxDepth: mergedOptions.maxDepth,
          maxArrayItems: mergedOptions.maxArrayItems,
          curl: mergedOptions.curl,
        }),
      );

      engine.addEntry(entry);
    })().catch(() => {});

    // Return the original response instantly so streaming works flawlessly
    return res;
  };
}
