# Enhanced README & CHANGELOG

**Date:** 2026-07-28
**Status:** Approved
**Scope:** Repo polish — badges, CHANGELOG.md, README improvements

## Goal

Improve the GitHub repository presentation: add badges, a changelog, contributing link, and a comparison table. No code changes.

## Changes

### 1. Badges (top of README)

Add shields.io badges immediately after the title:

- **npm version** — links to npm package page
- **CI Status** — links to GitHub Actions workflow
- **License** — links to LICENSE file
- **Downloads** — npm downloads per month

Format: `![badge](https://img.shields.io/badge/...)` with links `[badge](url)`.

### 2. CHANGELOG.md

New file at root. Simple list format — one section per version, bullet points for changes.

```text
# Changelog

## 1.1.1
- Fixed: JSR publishing workflow
- Added: JSDoc documentation for all exported symbols
- Added: CI/CD pipeline (GitHub Actions)
- Added: ESLint + Prettier configuration
- Added: Issue templates (bug report, feature request)

## 1.1.0
- Added: Fastify adapter with onRequest/preHandler/onSend hooks
- Added: Hono adapter with runtime-agnostic ReadableStream capture
- Added: cURL command generation (conditional via `curl` option)
- Added: `maxDepth` and `maxArrayItems` for smart body truncation
- Added: `CaptureResult` type with `bodyTruncated` flag
- Changed: Replaced Date.now() with performance.now() for timing
- Changed: Removed `start` field from TimingInfo
- Added: `timestamp` field to DebugEntry
- Fixed: Express adapter body truncation

## 1.0.0
- Initial release
- Express adapter with stream-level capture
- Body truncation with maxBodySize
- Header sanitization
- ANSI color output
- Filter function
```

### 3. Contributing section (README)

Short section after "How It Works", before "Exports":

```markdown
## Contributing

Contributions welcome! See the [contributing guide](docs/contributing.md) for setup, code style, and how to add a new adapter.

Quick start:
\`\`\`bash
git clone https://github.com/nacimoualla/http-debugger.git
cd http-debugger
npm install
npm test
\`\`\`
```

### 4. "Why not X?" section (README)

Comparison table after "How It Works":

```markdown
## Why not Morgan / Pino?

| Feature | http-debugger | Morgan | Pino |
|---------|:---:|:---:|:---:|
| Stream-level capture | ✅ | ❌ | ❌ |
| Request body capture | ✅ | ❌ | ❌ |
| Response body capture | ✅ | ❌ | ❌ |
| Body truncation | ✅ | ❌ | ❌ |
| cURL generation | ✅ | ❌ | ❌ |
| Zero runtime deps | ✅ | ✅ | ❌ |
| TypeScript support | ✅ | ❌ | ✅ |
| Express | ✅ | ✅ | ✅ |
| Fastify | ✅ | ❌ | ✅ |
| Hono / Edge | ✅ | ❌ | ❌ |

**Morgan** is great for access logs in production, but it doesn't capture request/response bodies and has no truncation or cURL output.

**Pino** is a high-performance structured logger, but it's a different use case — it requires manual instrumentation and doesn't intercept streams automatically.
```

## Files Modified

| File | Action |
|------|--------|
| `README.md` | Add badges, contributing section, comparison table |
| `CHANGELOG.md` | New file |

## Verification

- Badges render correctly on GitHub
- CHANGELOG matches git history
- README still renders correctly
- No broken links
