import { defineConfig } from 'vitest/config';

// Unit tests for the app's pure logic. The browser tests are Playwright's, under e2e/.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
