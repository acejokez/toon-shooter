import { defineConfig } from 'vitest/config';

// Keep Vitest (logic) and Playwright (E2E) in separate lanes.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
