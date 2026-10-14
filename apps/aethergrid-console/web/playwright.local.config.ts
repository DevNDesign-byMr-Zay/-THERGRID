import { defineConfig } from '@playwright/test';

// Deliberately has no webServer: this test must work with only file:// access.
export default defineConfig({
  testDir: './tests',
  testMatch: 'local-file.spec.ts',
  expect: { timeout: 45000 },
  use: {
    launchOptions: {
      executablePath: process.env.AETHERGRID_TEST_CHROMIUM,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    }
  }
});
