import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/__tests__',
  testMatch: '**/*.spec.ts',
  timeout: 15_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5176',
    launchOptions: process.env.AETHERGRID_TEST_CHROMIUM ? {
      executablePath: process.env.AETHERGRID_TEST_CHROMIUM,
      args: ['--no-sandbox'],
    } : undefined,
  },
  webServer: { command: 'npm run dev -- --port 5176 --strictPort', url: 'http://127.0.0.1:5176/tests/hook-harness.html' },
});
