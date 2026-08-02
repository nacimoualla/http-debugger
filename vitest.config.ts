import { defineConfig } from 'vitest/config';
import crypto from 'node:crypto';

if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = crypto;
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
