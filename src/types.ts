export interface TimingInfo {
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
  bodyTruncated: boolean;
  query: Record<string, string>;
  params: Record<string, string>;
}

export interface ResponseCapture {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  bodyTruncated: boolean;
  size: number;
}

export interface DebugEntry {
  id: string;
  timestamp: number;
  request: RequestCapture;
  response: ResponseCapture;
  timing: TimingInfo;
  duration: number;
}

export interface MiddlewareOptions {
  filter?: (entry: DebugEntry) => boolean;
  maxBodySize?: number;
  maxDepth?: number;
  maxArrayItems?: number;
  sanitize?: boolean;
  colors?: boolean;
  curl?: boolean | ((entry: DebugEntry) => boolean);
}
