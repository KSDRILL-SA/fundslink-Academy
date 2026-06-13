/// <reference types="vitest" />
import { defineConfig } from 'vite';

// Vitest is the unit-test runner for the Angular workspace (S4.56 — never Karma).
// Pure-TS units run here today. The Angular component-test harness (TestBed) is
// wired in Stage 02 alongside the first real components.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'libs/**/*.spec.ts'],
    reporters: ['default'],
  },
});
