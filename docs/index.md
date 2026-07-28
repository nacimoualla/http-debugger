# Documentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VitePress documentation site with TypeDoc API reference, migration guides, cookbook recipes, and architecture docs, deployed to GitHub Pages.

**Architecture:** VitePress static site generator with TypeDoc integration for auto-generated API reference. CI pipeline builds and deploys to GitHub Pages on main branch merges. JSR hosts its own API docs from package exports.

**Tech Stack:** VitePress, TypeDoc, typedoc-vitepress-theme, GitHub Actions, GitHub Pages

## Global Constraints

- Node.js >= 18 (matches project engines)
- pnpm for package management
- Zero runtime dependencies for the library (docs tooling is dev-only)
- TypeScript strict mode
- All new code follows existing ESLint/Prettier config
- Tests use Vitest
- Commits follow conventional commits

---

### Task 1: Add Documentation Dependencies and Scripts

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `docs:dev`, `docs:build`, `docs:preview` scripts

- [ ] **Step 1: Add devDependencies to package.json**

```json
{
  "devDependencies": {
    "typedoc": "^0.25.0",
    "typedoc-vitepress-theme": "^1.0.0",
    "vitepress": "^1.0.0",
    "vue": "^3.4.0"
  }
}
```

- [ ] **Step 2: Add documentation scripts to package.json**

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "typedoc --out docs/.vitepress/api src && vitepress build docs",
    "docs:preview": "vitepress preview docs"
  }
}
```

- [ ] **Step 3: Install and verify**

Run: `pnpm install`
Expected: Dependencies installed without errors

Run: `pnpm docs:dev --help`
Expected: Shows VitePress dev server help

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: add VitePress and TypeDoc dependencies"
```

---

### Task 2: Create VitePress Configuration

**Files:**
- Create: `docs/.vitepress/config.ts`
- Create: `docs/.vitepress/theme/index.ts` (minimal)

**Interfaces:**
- Consumes: Package name, version from package.json
- Produces: VitePress site config with nav, sidebar, search

- [ ] **Step 1: Create docs/.vitepress/config.ts**

```ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'http-debugger',
  description: 'Zero-dependency HTTP debug middleware for Node.js, Deno, Bun, and the Edge',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,
  metaChunk: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#0d1117' }]
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guides/migration/from-morgan', activeMatch: '/guides/' },
      { text: 'API Reference', link: '/api/', activeMatch: '/api/' },
      { text: 'Cookbook', link: '/guides/cookbook/ai-streaming', activeMatch: '/guides/cookbook/' },
      { text: 'Architecture', link: '/guides/architecture/adrs', activeMatch: '/guides/architecture/' },
      {
        text: 'v1.3.0',
        items: [
          { text: 'Changelog', link: 'https://github.com/nacimoualla/http-debugger/blob/main/CHANGELOG.md' },
          { text: 'Contributing', link: '/guides/architecture/contributing' }
        ]
      }
    ],

    sidebar: {
      '/guides/': [
        {
          text: 'Migration Guides',
          items: [
            { text: 'From Morgan', link: '/guides/migration/from-morgan' },
            { text: 'From Pino', link: '/guides/migration/from-pino' }
          ]
        },
        {
          text: 'Cookbook',
          items: [
            { text: 'AI Streaming', link: '/guides/cookbook/ai-streaming' },
            { text: 'GraphQL', link: '/guides/cookbook/graphql' },
            { text: 'Authentication', link: '/guides/cookbook/auth' },
            { text: 'File Uploads', link: '/guides/cookbook/file-uploads' },
            { text: 'WebSockets', link: '/guides/cookbook/websockets' }
          ]
        },
        {
          text: 'Architecture',
          items: [
            { text: 'ADRs', link: '/guides/architecture/adrs' },
            { text: 'Plugin Authoring', link: '/guides/architecture/plugin-authoring' },
            { text: 'Contributing', link: '/guides/architecture/contributing' }
          ]
        }
      ],
      '/api/': []
    },

    search: {
      provider: 'local',
      options: {
        detailedView: true
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nacimoualla/http-debugger' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/http-debugger' },
      { icon: 'jsr', link: 'https://jsr.io/@nacimoualla/http-debugger' }
    ],

    editLink: {
      pattern: 'https://github.com/nacimoualla/http-debugger/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Released under the MIT License with No-Resale Clause.',
      copyright: 'Copyright © 2024-present Nacim Oualla'
    }
  },

  vite: {
    optimizeDeps: {
      exclude: ['@nacimoualla/http-debugger']
    }
  }
})
```

- [ ] **Step 2: Create docs/.vitepress/theme/index.ts**

```ts
import DefaultTheme from 'vitepress/theme'
import './style.css'

export default {
  extends: DefaultTheme
}
```

- [ ] **Step 3: Create docs/.vitepress/theme/style.css**

```css
:root {
  --vp-c-brand-1: #58a6ff;
  --vp-c-brand-2: #79b8ff;
  --vp-c-brand-3: #388bfd;
  --vp-c-brand-soft: rgba(88, 166, 255, 0.15);
}

.VPNavBar {
  border-bottom: 1px solid var(--vp-c-divider);
}

.VPSidebar {
  border-right: 1px solid var(--vp-c-divider);
}
```

- [ ] **Step 4: Verify config loads**

Run: `pnpm docs:dev -- --port 5173 & sleep 3 && curl -s http://localhost:5173 | grep -q "http-debugger" && echo "OK"`
Expected: OK

- [ ] **Step 5: Commit**

```bash
git add docs/.vitepress
git commit -m "feat: add VitePress configuration with navigation and sidebar"
```

---

### Task 3: Create TypeDoc Configuration

**Files:**
- Create: `typedoc.json`

**Interfaces:**
- Produces: TypeDoc config for API reference generation

- [ ] **Step 1: Create typedoc.json**

```json
{
  "entryPoints": [
    "src/index.ts",
    "src/adapters/express.ts",
    "src/adapters/fastify.ts",
    "src/adapters/hono.ts",
    "src/adapters/next.ts",
    "src/types.ts",
    "src/core/timing.ts",
    "src/core/capture.ts",
    "src/core/formatter.ts",
    "src/core/sanitize.ts",
    "src/core/singleton.ts",
    "src/core/dashboard.ts",
    "src/core/stream.ts"
  ],
  "out": "docs/.vitepress/api",
  "theme": "vitepress",
  "name": "http-debugger",
  "readme": "README.md",
  "excludePrivate": true,
  "excludeProtected": true,
  "excludeInternal": true,
  "categorizeByGroup": false,
  "defaultCategory": "Core",
  "categoryOrder": [
    "Core",
    "Adapters",
    "Utilities",
    "Types",
    "Dashboard"
  ],
  "groupOrder": [
    "Functions",
    "Classes",
    "Interfaces",
    "Types",
    "Enums"
  ],
  "disableSources": true,
  "gitRemote": "https://github.com/nacimoualla/http-debugger",
  "gitRevision": "main",
  "tsconfig": "tsconfig.json",
  "skipErrorChecking": true,
  "plugin": ["typedoc-vitepress-theme"]
}
```

- [ ] **Step 2: Test TypeDoc generation**

Run: `pnpm exec typedoc --out docs/.vitepress/api src`
Expected: Generates markdown files in `docs/.vitepress/api/` without errors

- [ ] **Step 3: Verify output structure**

Run: `ls docs/.vitepress/api/`
Expected: Contains `modules.md`, `core.md`, `adapters_express.md`, etc.

- [ ] **Step 4: Commit**

```bash
git add typedoc.json
git commit -m "feat: add TypeDoc configuration for API reference generation"
```

---

### Task 4: Create Landing Page

**Files:**
- Create: `docs/index.md`

**Interfaces:**
- Produces: Landing page with hero, badges, quick start, framework tabs

- [ ] **Step 1: Create docs/index.md**

```md
---
layout: home

hero:
  name: "http-debugger"
  text: "Zero-dependency HTTP debug middleware"
  tagline: Stream-level request capture, smart body truncation, cURL generation, and framework adapters for Express, Fastify, Hono, and Next.js.
  image:
    src: /logo.svg
    alt: http-debugger logo
  actions:
    - theme: brand
      text: Get Started
      link: /guides/migration/from-morgan
    - theme: alt
      text: API Reference
      link: /api/
    - theme: alt
      text: View on GitHub
      link: https://github.com/nacimoualla/http-debugger

features:
  - icon: 🚀
    title: Stream-Level Capture
    details: Intercepts raw HTTP streams — no body parser middleware required. Captures request and response bodies exactly as they flow.
  - icon: ✂️
    title: Smart Body Truncation
    details: Configurable maxBodySize with automatic truncation. Deep JSON objects and large arrays collapse gracefully.
  - icon: 📋
    title: cURL Generation
    details: One-click reproduction. Generates ready-to-paste cURL commands with headers and body for any captured request.
  - icon: ⚡
    title: Zero Runtime Dependencies
    details: No dependencies in production. Framework adapters use only peer dependencies you already have.
  - icon: 🌐
    title: Edge-Compatible
    details: Hono and Next.js adapters use WinterCG standard APIs — runs on Cloudflare Workers, Deno, Bun, Vercel Edge.
  - icon: 📊
    title: Real-Time Dashboard
    details: Optional embedded web UI at /__debugger with SSE live updates, search, and request inspection.

---

## Quick Start

```bash
npm install http-debugger
```

### Express

```ts
import express from 'express'
import { httpDebugger } from 'http-debugger/express'

const app = express()
app.use(httpDebugger())
```

### Fastify

```ts
import Fastify from 'fastify'
import { httpDebugger } from 'http-debugger/fastify'

const fastify = Fastify()
fastify.register(httpDebugger)
```

### Hono

```ts
import { Hono } from 'hono'
import { httpDebugger } from 'http-debugger/hono'

const app = new Hono()
app.use('*', httpDebugger())
```

### Next.js (App Router)

```ts
// app/api/users/route.ts
import { withHttpDebugger } from 'http-debugger/next'

async function handler(req: Request) {
  return Response.json({ users: [] })
}

export const GET = withHttpDebugger(handler)

// app/__debugger/[[...route]]/route.ts
import { dashboardRoute } from 'http-debugger/next'

export const GET = dashboardRoute({ maxDepth: 4, sanitize: true })
```

---

## Why http-debugger?

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
| Next.js (App Router) | ✅ | ❌ | ❌ |