# Contributing to http-debugger

Thank you for contributing! This guide covers development setup, code style, testing, and the PR process.

## Development Setup

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Install

```bash
git clone https://github.com/nacimoualla/http-debugger
cd http-debugger
pnpm install
```

### Commands

```bash
# Run tests
pnpm test          # watch mode
pnpm test:run      # single run

# Type checking
pnpm typecheck

# Linting
pnpm lint          # check
pnpm lint:fix      # auto-fix

# Formatting
pnpm format        # write
pnpm format:check  # check only

# Build
pnpm build

# Documentation
pnpm docs:dev      # VitePress dev server
pnpm docs:build    # Build for production
```

## Project Structure

```
src/
├── index.ts                    # Main exports
├── types.ts                    # Core types (MiddlewareOptions, DebugEntry, etc.)
├── next.ts                     # Next.js adapter (HOF + catch-all)
├── adapters/
│   ├── express.ts              # Express middleware
│   ├── fastify.ts              # Fastify plugin
│   └── hono.ts                 # Hono middleware
└── core/
    ├── timing.ts               # High-res timing (performance.now)
    ├── capture.ts              # Body capture utilities
    ├── stream.ts               # Web stream reading with limit
    ├── formatter.ts            # Console output + cURL generation
    ├── sanitize.ts             # Header redaction
    ├── singleton.ts            # globalThis dashboard engine
    └── dashboard.ts            # Dashboard engine + HTML

tests/
├── adapters/                   # Adapter integration tests
├── core/                       # Unit tests for core utilities
└── setup.ts                    # Test utilities
```

## Code Style

### TypeScript

- **Strict mode** — no `any`, no implicit any
- **Explicit return types** on exported functions
- **JSDoc** on all exported symbols (TypeDoc compatible)
- **No enums** — use string literals or const objects

### Formatting (Prettier)

```json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true
}
```

### Linting (ESLint)

- `typescript-eslint` recommended
- No unused variables (`no-unused-vars: error`)
- Prefer `const` over `let`
- Explicit dependency arrays in hooks

## Testing

### Unit Tests (Core)

```ts
// tests/core/capture.test.ts
import { describe, it, expect } from 'vitest'
import { captureRequestBody } from '../../src/core/capture'

describe('captureRequestBody', () => {
  it('parses JSON from buffer chunks', () => {
    const chunks = [Buffer.from('{"name":"test"}')]
    const result = captureRequestBody(chunks, 'application/json')
    expect(result.body).toEqual({ name: 'test' })
    expect(result.truncated).toBe(false)
  })
})
```

### Integration Tests (Adapters)

```ts
// tests/adapters/express.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import { httpDebugger } from '../../src/adapters/express'

describe('Express adapter', () => {
  let app: express.Express
  let captured: string[]

  beforeEach(() => {
    captured = []
    app = express()
    app.use(httpDebugger({ colors: false }))
    vi.spyOn(console, 'log').mockImplementation((...args) => captured.push(args.join(' ')))
  })

  it('captures JSON response', async () => {
    app.get('/test', (_req, res) => res.json({ ok: true }))
    // ... fetch + assertions
  })
})
```

### Test Patterns

| Pattern | Example |
|---------|---------|
| Mock console | `vi.spyOn(console, 'log').mockImplementation(...)` |
| Async wait | `await new Promise(r => setTimeout(r, 100))` |
| Framework injection | Use `app.inject()` (Fastify) or `app.request()` (Hono) |
| Real HTTP server | `app.listen(0)` + `fetch()` (Express) |

## Adding a New Adapter

1. **Create** `src/adapters/myframework.ts`
2. **Export** factory: `export function httpDebugger(options: MiddlewareOptions)`
3. **Follow patterns** in existing adapters
4. **Add tests** in `tests/adapters/myframework.test.ts`
4. **Export** in `src/index.ts`
5. **Update** `tsup.config.ts` entry points
6. **Document** in `/docs/guides/architecture/plugin-authoring.md`

## PR Process

### Before Submitting

- [ ] `pnpm test:run` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm format:check` passes
- [ ] New tests for new features
- [ ] Updated docs if API changed

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Koa adapter
fix: handle empty response body in Hono adapter
docs: update migration guide for Morgan
chore: bump typedoc to v0.25
```

### PR Template

```markdown
## Summary
Brief description of changes.

## Type
- [ ] Feature
- [ ] Bug fix
- [ ] Documentation
- [ ] Refactor
- [ ] Test

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing done (describe)

## Checklist
- [ ] TypeScript compiles
- [ ] Lint passes
- [ ] Format passes
- [ ] Tests added/updated
- [ ] Docs updated
```

## Release Process

Maintainers only:

1. `pnpm version patch|minor|major` — updates package.json, creates tag
2. `git push --follow-tags` — triggers release workflow
3. GitHub Actions: test → build → npm publish → JSR publish → GitHub Release

## Questions?

- Open a [Discussion](https://github.com/nacimoualla/http-debugger/discussions)
- Check existing [Issues](https://github.com/nacimoualla/http-debugger/issues)
- Read the [Architecture ADRs](/guides/architecture/adrs.md)