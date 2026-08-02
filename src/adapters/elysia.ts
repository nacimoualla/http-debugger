import { DebugEntry, MiddlewareOptions } from '../types';
import { createTiming } from '../core/timing';
import { generateId } from '../core/capture';
import { formatEntry } from '../core/formatter.js';
import { Elysia } from 'elysia';
import { readBodyWithLimit } from '../core/stream';
import { createDashboardEngine, DASHBOARD_HTML } from '../core/dashboard';
import { DashboardAuthFn } from '../types';
import { isTTY } from './hono';

export function httpDebugger(options: MiddlewareOptions = {}) {
  const maxBodySize = options.maxBodySize ?? 1024;
  const engine = createDashboardEngine(
    typeof options.dashboard === 'object' ? options.dashboard.maxEntries : undefined,
  );
  const dashboardAuth: DashboardAuthFn | undefined =
    typeof options.dashboard === 'object' ? options.dashboard.auth : undefined;
  const stateMap = new WeakMap<
    Request,
    {
      timing: ReturnType<typeof createTiming>;
      id: string;
      reqBody: unknown;
      reqTruncated: boolean;
    }
  >();
  return new Elysia({ name: 'httpDebugger' })
    .onRequest(async ({ request }) => {
      const timing = createTiming();
      const id = generateId();
      timing.markHeadersReceived();
      if (engine.isEnabled) {
        const url = new URL(request.url);
        if (url.pathname === '/__debugger' || url.pathname === '/__debugger/stream') {
          if (dashboardAuth) {
            const allowed = await dashboardAuth(request);
            if (!allowed) {
              return new Response('Forbidden', { status: 403 });
            }
          }
          if (url.pathname === '/__debugger') {
            return new Response(DASHBOARD_HTML, {
              headers: { 'Content-Type': 'text/html' },
            });
          }
          if (url.pathname === '/__debugger/stream') {
            let teardown: (() => void) | undefined;
            const stream = new ReadableStream({
              start(controller) {
                const sendFn = (chunks: string) => {
                  controller.enqueue(new TextEncoder().encode(chunks));
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
                'Cache-control': 'no-cache',
                Connection: 'keep-alive',
              },
            });
          }
        }
      }
      const reqClone = request.clone();
      const { body: reqBodyStr, truncated: reqTruncated } = await readBodyWithLimit(
        reqClone.body,
        maxBodySize,
      );
      let reqBody: unknown = null;
      if (reqBodyStr) {
        const contentType = request.headers.get('content-type') || '';
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
      stateMap.set(request, { timing, id, reqBody, reqTruncated });
    })
    .onAfterHandle(async ({ request, response, set }) => {
      const state = stateMap.get(request);
      const useColors = options.colors !== undefined ? options.colors : isTTY;
      if (!state) return;
      state.timing.markHandlerEnd();
      state.timing.markResponseStart();
      let resBody: unknown = response;
      if (typeof response === 'string') {
        try {
          resBody = JSON.parse(response);
        } catch {
          /* keep as string */
        }
      }
      state.timing.markResponseEnd();
      const entry: DebugEntry = {
        id: state.id,
        timestamp: Date.now(),
        request: {
          method: request.method,
          path: new URL(request.url).pathname,
          headers: Object.fromEntries(request.headers.entries()) as Record<string, string>,
          body: state.reqBody,
          bodyTruncated: state.reqTruncated,
          query: Object.fromEntries(new URL(request.url).searchParams),
          params: {},
        },
        response: {
          statusCode: Number(set.status),
          headers: set.headers as Record<string, string>,
          body: resBody,
          bodyTruncated: false,
          size: typeof resBody === 'string' ? Buffer.byteLength(resBody) : 0,
        },
        timing: state.timing.toJSON(),
        duration: state.timing.duration,
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
      stateMap.delete(request);
    })
    .as('global') as any;
}
