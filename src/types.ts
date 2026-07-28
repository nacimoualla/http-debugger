/** High-resolution timing data for a single HTTP request lifecycle. */
export interface TimingInfo {
  /** Time in ms from request start to when headers were received. */
  headersReceived: number;
  /** Time in ms from request start to when the request body was fully read. */
  bodyComplete: number;
  /** Time in ms from request start to when the route handler began executing. */
  handlerStart: number;
  /** Time in ms from request start to when the route handler finished executing. */
  handlerEnd: number;
  /** Time in ms from request start to when the response body started being written. */
  responseStart: number;
  /** Time in ms from request start to when the response was fully sent. */
  responseEnd: number;
}

/** Captured request data for a single HTTP request. */
export interface RequestCapture {
  /** HTTP method (GET, POST, etc.). */
  method: string;
  /** Request path or URL. */
  path: string;
  /** Request headers as key-value pairs. */
  headers: Record<string, string>;
  /** Parsed request body, or null if empty/unavailable. */
  body: unknown;
  /** Whether the request body exceeded maxBodySize and was truncated. */
  bodyTruncated: boolean;
  /** Parsed query string parameters. */
  query: Record<string, string>;
  /** Route parameters (e.g., :id in Express). */
  params: Record<string, string>;
}

/** Captured response data for a single HTTP response. */
export interface ResponseCapture {
  /** HTTP status code (e.g., 200, 404, 500). */
  statusCode: number;
  /** Response headers as key-value pairs. */
  headers: Record<string, string>;
  /** Parsed response body, or null if empty/unavailable/truncated. */
  body: unknown;
  /** Whether the response body exceeded maxBodySize and was truncated. */
  bodyTruncated: boolean;
  /** Response body size in bytes. */
  size: number;
}

/** Complete debug entry for a single HTTP request/response cycle. */
export interface DebugEntry {
  /** Unique identifier for this request (UUID). */
  id: string;
  /** Timestamp when the request was captured (Date.now()). */
  timestamp: number;
  /** Captured request data. */
  request: RequestCapture;
  /** Captured response data. */
  response: ResponseCapture;
  /** High-resolution timing breakdown. */
  timing: TimingInfo;
  /** Total request duration in ms. */
  duration: number;
}

/** Configuration options for the http-debugger middleware. */
export interface MiddlewareOptions {
  /** Filter function — only log entries where this returns true. */
  filter?: (entry: DebugEntry) => boolean;
  /** Max bytes to capture per body before truncating (default: 1024). */
  maxBodySize?: number;
  /** Max JSON nesting depth before collapsing objects (default: 4). */
  maxDepth?: number;
  /** Max array items to show before truncating (default: 10). */
  maxArrayItems?: number;
  /** Automatically redact Authorization and Cookie headers (default: true). */
  sanitize?: boolean;
  /** Enable/disable ANSI color output. Auto-detects TTY if not set. */
  colors?: boolean;
  /** Show cURL command. Pass true for always, or a function for conditional output. */
  curl?: boolean | ((entry: DebugEntry) => boolean);
}
