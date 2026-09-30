import { defineConfig } from 'vitest/config';

// Unit tests for the app's pure logic (no phone or simulator needed).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
