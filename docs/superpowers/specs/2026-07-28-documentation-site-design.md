# Documentation Site Design

**Date:** 2026-07-28
**Status:** Approved
**Scope:** VitePress documentation site with JSR integration

## Goal

Build a documentation site that provides excellent developer experience for http-debugger users, with auto-generated API reference, migration guides from Morgan/Pino, cookbook recipes, and architecture documentation.

## Architecture

**Hosting:** GitHub Pages (VitePress build output)
**API Reference:** JSR hosts its own docs from package exports
**Build Pipeline:** `pnpm docs:build` → VitePress builds typedoc + markdown → CI deploys to GitHub Pages

## Site Structure

```
/ (Landing)
├── Hero with badges, quick install, framework selector
├── Feature highlights with terminal output screenshots
└── Links to guides, API, dashboard demo

/api/
├── Auto-generated from typedoc (core types, adapters, utilities)
├── Versioned with package releases
└── JSR mirrors this at jsr.io/@nacimoualla/http-debugger

/guides/
├── /migration/
│   ├── from-morgan.md — Side-by-side config comparison, feature matrix
│   └── from-pino.md — Structured logger migration, differences explained
├── /cookbook/
│   ├── ai-streaming.md — OpenAI/Anthropic streaming with dashboard
│   ├── graphql.md — Apollo/GraphQL Yoga request/response capture
│   ├── auth.md — JWT, session, cookie header handling
│   ├── file-uploads.md — multipart/form-data body capture
│   └── websockets.md — Upgrade handling, connection tracking
└── /architecture/
    ├── adrs/ — Architecture Decision Records
    ├── plugin-authoring.md — Custom adapter interface
    └── contributing.md — Development setup, code style, testing

/dashboard/ (optional future)
└── Interactive iframe embed of live dashboard
```

## Technical Stack

| Tool | Purpose |
|------|---------|
| VitePress | Static site generator, Vue-based, fast HMR |
| TypeDoc | API reference generation from TypeScript source |
| typedoc-vitepress-theme | Custom theme for VitePress integration |
| GitHub Actions | CI: build, typecheck, test, deploy |
| GitHub Pages | Hosting (custom domain possible) |
| JSR | Auto-hosts API docs from package exports |

## Migration Guides Format

Each migration guide follows this template:

```markdown
# Migrating from [Logger] to http-debugger

## Quick Comparison

| Feature | [Logger] | http-debugger |
|---------|----------|---------------|
| Request body capture | ❌ | ✅ |
| Response body capture | ❌ | ✅ |
| Body truncation | ❌ | ✅ |
| cURL generation | ❌ | ✅ |
| Zero runtime deps | ✅/❌ | ✅ |

## Express Example

### Before (Morgan)
```js
app.use(morgan('combined'))
```

### After (http-debugger)
```ts
import { httpDebugger } from 'http-debugger/express'
app.use(httpDebugger())
```

## Configuration Mapping

| Morgan Token | http-debugger Option |
|--------------|---------------------|
| `:method` | Auto-captured |
| `:url` | Auto-captured |
| `:status` | Auto-captured |
| `:response-time` | `timing.duration` |
```

## Cookbook Recipe Format

Each recipe is a standalone page:

```markdown
# Recipe: AI Streaming Responses

## Problem
Capture streaming responses from OpenAI/Anthropic without buffering.

## Solution
Use http-debugger with default settings — it handles streams natively.

## Code
```ts
import { httpDebugger } from 'http-debugger/express'
import OpenAI from 'openai'

const app = express()
app.use(httpDebugger({ maxBodySize: 4096 }))

app.post('/chat', async (req, res) => {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: req.body.messages,
    stream: true
  })

  for await (const chunk of stream) {
    res.write(chunk.choices[0]?.delta?.content ?? '')
  }
  res.end()
})
```

## Dashboard Screenshot
![Dashboard showing streaming request](/assets/cookbook/ai-streaming.png)

## Generated cURL
```bash
curl -X POST 'http://localhost:3000/chat' \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```
```

## CI Pipeline

```yaml
# .github/workflows/docs.yml
name: Deploy Docs
on:
  push:
    branches: [main]
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm docs:build
      - uses: peaceiris/actions-gh-pages@v3
        if: github.ref == 'refs/heads/main'
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/.vitepress/dist
```

## Package.json Scripts

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "typedoc --out docs/.vitepress/api src && vitepress build docs",
    "docs:preview": "vitepress preview docs"
  },
  "devDependencies": {
    "typedoc": "^0.25.0",
    "typedoc-vitepress-theme": "^1.0.0",
    "vitepress": "^1.0.0"
  }
}
```

## Typedoc Configuration

```json
// typedoc.json
{
  "entryPoints": ["src/index.ts", "src/adapters/"],
  "out": "docs/.vitepress/api",
  "theme": "vitepress",
  "name": "http-debugger",
  "readme": "README.md",
  "excludePrivate": true,
  "excludeProtected": true,
  "categorizeByGroup": false,
  "defaultCategory": "Core",
  "categoryOrder": [
    "Core",
    "Adapters",
    "Utilities",
    "Types"
  ]
}
```

## VitePress Configuration

```ts
// docs/.vitepress/config.ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'http-debugger',
  description: 'Zero-dependency HTTP debug middleware',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guides/migration/from-morgan' },
      { text: 'API', link: '/api/' },
      { text: 'Cookbook', link: '/guides/cookbook/ai-streaming' },
      { text: 'Architecture', link: '/guides/architecture/adrs' }
    ],
    sidebar: {
      '/guides/': [
        { text: 'Migration', items: [
          { text: 'From Morgan', link: '/guides/migration/from-morgan' },
          { text: 'From Pino', link: '/guides/migration/from-pino' }
        ]},
        { text: 'Cookbook', items: [
          { text: 'AI Streaming', link: '/guides/cookbook/ai-streaming' },
          { text: 'GraphQL', link: '/guides/cookbook/graphql' },
          { text: 'Auth', link: '/guides/cookbook/auth' },
          { text: 'File Uploads', link: '/guides/cookbook/file-uploads' },
          { text: 'WebSockets', link: '/guides/cookbook/websockets' }
        ]},
        { text: 'Architecture', items: [
          { text: 'ADRs', link: '/guides/architecture/adrs' },
          { text: 'Plugin Authoring', link: '/guides/architecture/plugin-authoring' },
          { text: 'Contributing', link: '/guides/architecture/contributing' }
        ]}
      ],
      '/api/': []
    },
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/nacimoualla/http-debugger' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/http-debugger' }
    ]
  }
})
```

## Implementation Tasks

1. **Setup VitePress** — Add deps, config, basic structure
2. **Configure TypeDoc** — typedoc.json + theme integration
3. **Create Landing Page** — Hero, badges, framework tabs
4. **Write Migration Guides** — Morgan + Pino
5. **Write Cookbook Recipes** — 5 initial recipes
6. **Add Architecture Docs** — ADRs, plugin authoring, contributing
7. **CI Pipeline** — Build + deploy to GitHub Pages
8. **Verify JSR Sync** — Confirm JSR auto-docs match

## Success Criteria

- [ ] `pnpm docs:dev` starts dev server with HMR
- [ ] `pnpm docs:build` produces clean output
- [ ] API reference auto-generates from source
- [ ] Migration guides render correctly
- [ ] Cookbook recipes have working code blocks
- [ ] GitHub Pages deployment works on merge to main
- [ ] JSR docs at jsr.io/@nacimoualla/http-debugger are accurate