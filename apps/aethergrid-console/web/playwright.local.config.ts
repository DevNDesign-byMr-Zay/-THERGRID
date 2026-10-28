import { defineConfig } from '@playwright/test';

// Deliberately has no webServer: this test must work with only file:// access.
export default defineConfig({
  testDir: './tests',
  testMatch: 'local-file.spec.ts',
  // GPU-heavy multi-city browser runs can lose a Chromium context after
  // several successful cities. Retry once in a fresh worker, retaining all
  // geography/renderer assertions and preserving failure evidence.
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 45000 },
  use: {
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: process.env.AETHERGRID_TEST_CHROMIUM,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    }
  }
});
