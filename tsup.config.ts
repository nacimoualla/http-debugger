import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/adapters/express.ts',
    'src/adapters/fastify.ts',
    'src/adapters/hono.ts',
    'src/next.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
});
