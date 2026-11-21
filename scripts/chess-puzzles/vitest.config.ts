import { defineConfig } from 'vitest/config';

/** Separate config so the slow puzzle generator never runs with the unit tests. */
export default defineConfig({ test: { include: ['scripts/chess-puzzles/generate.test.ts'], environment: 'node', testTimeout: 3_600_000 } });
