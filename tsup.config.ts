import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/adapters/astro.ts',
    'src/adapters/express.ts',
    'src/adapters/fastify.ts',
    'src/adapters/hono.ts',
    'src/next.ts',
    'src/adapters/elysia.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
});
