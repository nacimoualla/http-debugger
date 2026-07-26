export interface TimingInfo {
  start: number;
  headersReceived: number;
  bodyComplete: number;
  handlerStart: number;
  handlerEnd: number;
  responseStart: number;
  responseEnd: number;
}

export interface RequestCapture {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
}

export interface ResponseCapture {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  size: number;
}

export interface DebugEntry {
  id: string;
  request: RequestCapture;
  response: ResponseCapture;
  timing: TimingInfo;
  duration: number;
}

export interface MiddlewareOptions {
  filter?: (entry: DebugEntry) => boolean;
  maxBodySize?: number;
  sanitize?: boolean;
  colors?: boolean;
}
