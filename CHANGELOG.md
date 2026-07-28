# Changelog

## 1.2.0
- Added: Embedded web dashboard with real-time SSE updates
- Added: Factory-isolated `createDashboardEngine()` for multi-instance safety
- Added: Production guard (dashboard disabled when NODE_ENV=production)
- Added: Ring buffer for request history (configurable via `dashboard.maxEntries`)
- Added: Hydration on SSE connect (new clients receive historical entries)
- Added: Teardown on disconnect (prevents memory leaks)
- Added: Dashboard option to all adapters (Express, Fastify, Hono)

## 1.1.1
- Fixed: JSR publishing workflow
- Added: JSDoc documentation for all exported symbols
- Added: CI/CD pipeline (GitHub Actions)
- Added: ESLint + Prettier configuration
- Added: Issue templates (bug report, feature request)
- Added: Package documentation (API reference, contributing guide)
- Changed: Improved npm search discoverability (description, keywords, repository)

## 1.1.0
- Added: Fastify adapter with onRequest/preHandler/onSend hooks
- Added: Hono adapter with runtime-agnostic ReadableStream capture
- Added: cURL command generation (conditional via `curl` option)
- Added: `maxDepth` and `maxArrayItems` for smart body truncation
- Added: `CaptureResult` type with `bodyTruncated` flag
- Changed: Replaced Date.now() with performance.now() for high-resolution timing
- Changed: Removed `start` field from TimingInfo
- Added: `timestamp` field to DebugEntry
- Fixed: Express adapter body truncation
- Fixed: Hono adapter header serialization

## 1.0.0
- Initial release
- Express adapter with stream-level capture
- Body truncation with maxBodySize
- Header sanitization (Authorization, Cookie)
- ANSI color output with auto TTY detection
- Filter function for selective logging
