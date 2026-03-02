import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@customer': path.resolve(__dirname, 'apps/customer'),
      '@driver': path.resolve(__dirname, 'apps/driver'),
      '@admin': path.resolve(__dirname, 'apps/admin'),
    },
  },
});
