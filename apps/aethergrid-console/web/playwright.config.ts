import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:5174', screenshot: 'only-on-failure',
    launchOptions: process.env.AETHERGRID_TEST_CHROMIUM ? {
      executablePath: process.env.AETHERGRID_TEST_CHROMIUM,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    } : undefined
  },
  webServer: [
    { command: 'node --env-file-if-exists=../.env.secrets ../server.mjs', url: 'http://127.0.0.1:8090/api/aethergrid/config/public', reuseExistingServer: true },
    { command: process.env.AETHERGRID_TEST_BUILT === '1' ? 'npm run preview -- --port 5174 --strictPort' : 'npm run dev', url: 'http://127.0.0.1:5174', reuseExistingServer: true }
  ],
  reporter: [['list'], ['json', { outputFile: 'test-results/acceptance.json' }]]
});
