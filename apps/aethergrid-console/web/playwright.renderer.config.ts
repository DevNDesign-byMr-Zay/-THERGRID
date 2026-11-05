import { defineConfig } from '@playwright/test';

// Deterministic draw-command and lifecycle tests; actual browser/GPU acceptance stays separate.
export default defineConfig({
  testDir: './tests',
  testMatch: ['native-*.spec.ts', 'cesium-properties.spec.ts'],
  workers: 1,
  timeout: 15_000,
});
