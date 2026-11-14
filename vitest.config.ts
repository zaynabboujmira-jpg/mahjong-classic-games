import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // AI and generator tests play whole games; shared CI runners can be 2x slower than a laptop,
    // so the 5 s default made them flaky. Real speed limits are asserted inside the tests.
    testTimeout: 30_000,
  },
});
