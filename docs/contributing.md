# Contributing

## Prerequisites

- Node.js >= 18
- npm

## Setup

```bash
git clone https://github.com/nacimoualla/http-debugger.git
cd http-debugger
npm install
```

## Development

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Typecheck
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Build
npm run build
```

## Project Structure

```
src/
├── adapters/        # Framework-specific integrations
├── core/            # Shared logic (timing, capture, formatter, sanitize)
├── index.ts         # Public API exports
└── types.ts         # TypeScript interfaces

tests/
├── adapters/        # Adapter tests (Express, Fastify, Hono)
└── core/            # Core module tests
```

## Adding a New Adapter

1. Create `src/adapters/your-framework.ts`
2. Export `httpDebugger(options?: MiddlewareOptions)` as a middleware/plugin
3. Create `tests/adapters/your-framework.test.ts`
4. Add the adapter to `tsup.config.ts` entry array
5. Add export to `package.json` exports map
6. Add peer dependency (optional)

## Code Style

- No comments in source code (JSDoc on public API only)
- TypeScript strict mode
- Prettier for formatting
- ESLint for linting

## Testing

Tests use Vitest. Each adapter test should cover:

- Basic request/response capture
- Request body capture
- Response body capture
- Header sanitization
- cURL generation
- Large body truncation

## Pull Requests

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run `npm run lint`, `npm run typecheck`, `npm run test:run`
5. Submit a PR

## Release

Releases are automated via GitHub Actions:

1. Update version in `package.json` and `jsr.json`
2. Commit: `git commit -m "chore: bump version to X.Y.Z"`
3. Tag: `git tag vX.Y.Z`
4. Push: `git push origin main --tags`

This triggers the release workflow which:
- Runs typecheck, tests, and build
- Publishes to npm with provenance
- Publishes to JSR
- Creates a GitHub Release with auto-generated notes
