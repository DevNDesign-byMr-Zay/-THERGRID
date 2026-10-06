import { defineConfig } from '@playwright/test';

const canonical = process.env.AETHERGRID_TEST_CANONICAL === '1';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  use: {
    baseURL: canonical ? 'http://127.0.0.1:8090' : 'http://127.0.0.1:5174', screenshot: 'only-on-failure',
    proxy: process.env.AETHERGRID_TEST_PROXY ? { server: process.env.AETHERGRID_TEST_PROXY, bypass: '127.0.0.1,localhost' } : undefined,
    launchOptions: process.env.AETHERGRID_TEST_CHROMIUM ? {
      executablePath: process.env.AETHERGRID_TEST_CHROMIUM,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    } : undefined
  },
  webServer: canonical ? [
    { command: 'node ../server.mjs', url: 'http://127.0.0.1:8090', reuseExistingServer: true }
  ] : [
    { command: 'node --env-file-if-exists=../.env.secrets ../server.mjs', url: 'http://127.0.0.1:8090/api/aethergrid/config/public', reuseExistingServer: true },
    { command: process.env.AETHERGRID_TEST_BUILT === '1' ? 'npm run preview -- --port 5174 --strictPort' : 'npm run dev', url: 'http://127.0.0.1:5174', reuseExistingServer: true }
  ],
  reporter: [['list'], ['json', { outputFile: 'test-results/acceptance.json' }]]
});
