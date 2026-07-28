# Enhanced README & CHANGELOG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add badges, CHANGELOG.md, contributing section, and comparison table to the repo.

**Architecture:** Edit existing README.md, create new CHANGELOG.md. No code changes.

**Tech Stack:** Markdown, shields.io badges

## Global Constraints

- No code changes — only README.md and CHANGELOG.md
- Keep existing README structure intact, add new sections
- Badges use shields.io static badges
- CHANGELOG uses simple list format

---

### Task 1: Add Badges to README

**Files:**
- Modify: `README.md:1-6`

**Interfaces:**
- Consumes: existing README
- Produces: README with badges at top

- [ ] **Step 1: Add badges after title**

Add after line 1 (`# http-debugger`), before the tagline:

```markdown
[![npm version](https://img.shields.io/npm/v/http-debugger.svg)](https://www.npmjs.com/package/http-debugger)
[![CI](https://github.com/nacimoualla/http-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/nacimoualla/http-debugger/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/http-debugger.svg)](./LICENSE)
[![Downloads](https://img.shields.io/npm/dm/http-debugger.svg)](https://www.npmjs.com/package/http-debugger)
```

- [ ] **Step 2: Verify badges render**

Run: `cat README.md | head -8`
Expected: Title followed by 4 badge lines, then blank line, then tagline.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add npm version, CI, license, and downloads badges"
```

---

### Task 2: Create CHANGELOG.md

**Files:**
- Create: `CHANGELOG.md`

**Interfaces:**
- Consumes: git history
- Produces: CHANGELOG.md

- [ ] **Step 1: Create CHANGELOG.md**

```markdown
# Changelog

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
```

- [ ] **Step 2: Verify file exists**

Run: `cat CHANGELOG.md | head -5`
Expected: `# Changelog` followed by `## 1.1.1`

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG.md"
```

---

### Task 3: Add Contributing Section to README

**Files:**
- Modify: `README.md` — add section after "How It Works", before "Exports"

**Interfaces:**
- Consumes: existing README, docs/contributing.md (already exists)
- Produces: README with contributing section

- [ ] **Step 1: Add contributing section**

Insert after the "How It Works" section (after line 125), before "Exports":

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

- [ ] **Step 2: Verify section exists**

Run: `grep -n "Contributing" README.md`
Expected: Line number for the new section.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add contributing section to README"
```

---

### Task 4: Add Comparison Table to README

**Files:**
- Modify: `README.md` — add section after "How It Works", before "Contributing"

**Interfaces:**
- Consumes: existing README
- Produces: README with comparison table

- [ ] **Step 1: Add comparison section**

Insert after "How It Works" section (after line 125), before the new Contributing section:

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

- [ ] **Step 2: Verify table exists**

Run: `grep -n "Morgan" README.md`
Expected: Line numbers for the comparison section.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add comparison table (Morgan, Pino)"
```

---

### Task 5: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify README renders**

Run: `cat README.md`
Expected: All sections present — title, badges, tagline, output, features, install, quick start, config, how it works, comparison, contributing, exports, license.

- [ ] **Step 2: Verify CHANGELOG exists**

Run: `cat CHANGELOG.md`
Expected: 3 versions listed (1.0.0, 1.1.0, 1.1.1).

- [ ] **Step 3: Verify no broken links**

Run: `grep -o 'docs/[^ )]*' README.md`
Expected: All referenced files exist (`docs/contributing.md`).

- [ ] **Step 4: Final commit if needed**

```bash
git add .
git commit -m "docs: final verification" --allow-empty
```
