import type { MiddlewareOptions } from './types.js';
import { engine, getDashboardOptions } from './core/singleton.js';
import { readBodyWithLimit } from './core/stream.js';
import { createTiming } from './core/timing.js';
import { generateId } from './core/capture.js';
import { formatEntry } from './core/formatter.js';

export function dashboardRoute(options?: { maxEntries?: number }): (req: Request) => Response {
  return (_req: Request): Response => {
    return new Response('Dashboard route not yet implemented', { status: 501 });
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

      const entry = {
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

      engine.addEntry(entry as any);
    })();

    // Return the original response instantly so streaming works flawlessly
    return res;
  };
}
