import { expect, test } from '@playwright/test';

test('panel state retains workspace selection, closes navigation and restores focus on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('/tests/hook-harness.html?hook=panels');
  await page.locator('#trigger').click();
  await expect(page.getByRole('button', { name: 'Navigation', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#trigger')).toBeFocused();
  await page.evaluate(() => (window as any).hook.showIntelligence('analysis'));
  await expect.poll(() => page.evaluate(() => ({
    nav: (window as any).hook.navOpen, intel: (window as any).hook.intelOpen,
    workspace: (window as any).hook.intelWorkspace, inspector: (window as any).hook.inspector,
  }))).toEqual({ nav: false, intel: true, workspace: 'analysis', inspector: 'overview' });
  await page.evaluate(() => (window as any).update({ scope: 'world', visualMode: 'solid' }));
  await expect.poll(() => page.evaluate(() => (window as any).hook.productMode)).toBe('GLOBAL');
  await page.evaluate(() => (window as any).update({ scope: 'city', visualMode: 'holographic' }));
  await expect.poll(() => page.evaluate(() => (window as any).hook.productMode)).toBe('HOLOGRAPHIC');
});
