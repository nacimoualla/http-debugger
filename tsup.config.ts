import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/adapters/express.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
});
