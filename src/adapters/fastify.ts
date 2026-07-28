import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { MiddlewareOptions, DebugEntry } from '../types.js';
import { createTiming, Timing } from '../core/timing.js';
import { generateId } from '../core/capture.js';
import { formatEntry } from '../core/formatter.js';

export const httpDebugger: FastifyPluginAsync<MiddlewareOptions> = async (fastify, options) => {
  const maxBodySize = options.maxBodySize ?? 1024;

  fastify.decorateRequest('httpDebuggerTiming', null);
  fastify.decorateRequest('httpDebuggerId', null);

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const timing = createTiming();
    const id = generateId();

    (request as any).httpDebuggerTiming = timing;
    (request as any).httpDebuggerId = id;

    timing.markHeadersReceived();
  });

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const timing = (request as any).httpDebuggerTiming as Timing;
    timing.markBodyComplete();
  });

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: string | Buffer) => {
    const timing = (request as any).httpDebuggerTiming as Timing;
    const id = (request as any).httpDebuggerId as string;

    timing.markResponseEnd();

    const bodyStr = typeof payload === 'string' ? payload : payload.toString('utf-8');
    let responseBody: unknown = null;
    let bodyTruncated = false;

    if (bodyStr) {
      const bytes = Buffer.byteLength(bodyStr);
      if (bytes > maxBodySize) {
        bodyTruncated = true;
      } else {
        try {
          responseBody = JSON.parse(bodyStr);
        } catch {
          responseBody = bodyStr;
        }
      }
    }

    const reqBody = request.body;
    const reqBodyTruncated = reqBody && typeof reqBody === 'object' && (reqBody as any).__truncated;

    const entry: DebugEntry = {
      id,
      timestamp: Date.now(),
      request: {
        method: request.method,
        path: request.url,
        headers: request.headers as Record<string, string>,
        body: reqBodyTruncated ? null : reqBody ?? null,
        bodyTruncated: !!reqBodyTruncated,
        query: request.query as Record<string, string>,
        params: request.params as Record<string, string>,
      },
      response: {
        statusCode: reply.statusCode,
        headers: reply.getHeaders() as Record<string, string>,
        body: bodyTruncated ? null : responseBody,
        bodyTruncated,
        size: Buffer.byteLength(bodyStr),
      },
      timing: timing.toJSON(),
      duration: timing.duration,
    };

    if (options.filter && !options.filter(entry)) return;

    console.log(formatEntry(entry, {
      colors: options.colors,
      sanitize: options.sanitize,
      maxDepth: options.maxDepth,
      maxArrayItems: options.maxArrayItems,
      curl: options.curl,
    }));
  });
};

(httpDebugger as any)[Symbol.for('skip-override')] = true;

export default httpDebugger;
