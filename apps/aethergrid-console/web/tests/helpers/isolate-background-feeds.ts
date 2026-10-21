import type { Page } from '@playwright/test';

/** Keep focused UI contracts independent of third-party feed volume/latency.
 * Canonical model, provider registry and evidence requests still reach Node.
 * Feed/renderer acceptance suites deliberately do not use this helper.
 */
export async function isolateBackgroundFeeds(page: Page): Promise<void> {
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(host)
      ? route.continue() : route.abort('internetdisconnected');
  });
  await page.route('**/api/aethergrid/**', route => {
    const path = new URL(route.request().url()).pathname;
    const runtime = [
      '/api/aethergrid/config/public', '/api/aethergrid/profile',
      '/api/aethergrid/runtime', '/api/aethergrid/runtime/providers',
      '/api/aethergrid/team', '/api/aethergrid/evidence'
    ].includes(path) || ['/api/aethergrid/auth/', '/api/aethergrid/agents/', '/api/aethergrid/evidence/']
      .some(prefix => path.startsWith(prefix));
    return runtime ? route.continue() : route.fulfill({
      status: 503, json: { error: 'Unrelated background feed unavailable during focused UI acceptance' }
    });
  });
}
