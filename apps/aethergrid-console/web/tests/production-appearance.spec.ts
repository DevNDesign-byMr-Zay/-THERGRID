import { expect, test } from '@playwright/test';

test('system theme reacts to OS while explicit choice survives rejected storage', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('aethergrid.operator.appearance.v4', 'system');
    Storage.prototype.setItem = () => { throw new Error('storage denied'); };
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true', { timeout: 30_000 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Appearance: system. Select to cycle theme.' }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const [width, height] of [[1536, 1024], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [844, 390]]) {
  test(`operator controls stay reachable in light mode ${width}x${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => localStorage.setItem('aethergrid.operator.appearance.v4', 'light'));
    await page.goto('/');
    await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
    const settings = page.locator('.settings-panel:visible');
    await expect(settings).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width <= 1100) {
      const close = page.getByRole('button', { name: 'Close intelligence drawer' });
      const bounds = await close.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      await close.click();
    }
    await page.getByRole('button', { name: 'Operator profile' }).click();
    const profile = page.getByRole('dialog', { name: 'Operator profile' });
    await expect(profile).toBeVisible();
    const contrast = await profile.evaluate((element) => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = (color: number[]) => color.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const background = luminance(rgb(getComputedStyle(element).backgroundColor));
      const label = element.querySelector('footer button')!;
      const foreground = luminance(rgb(getComputedStyle(label).color));
      return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
    });
    expect(contrast, 'profile action must meet normal text contrast').toBeGreaterThanOrEqual(4.5);
    const save = profile.getByRole('button', { name: 'SAVE PROFILE' });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await page.screenshot({ path: `test-results/production-light-profile-${width}x${height}.png` });
  });
}

test('light drawers and actions remain usable at 200 percent text size', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('aethergrid.operator.appearance.v4', 'light'));
  await page.goto('/');
  const enlargeText = () => page.evaluate(() => {
    const elements = [...document.querySelectorAll<HTMLElement>('button, input, textarea, select, p, strong, small, span, label, em, h1, h2, h3')];
    const sizes = elements.map((element) => parseFloat(getComputedStyle(element).fontSize));
    elements.forEach((element, index) => element.style.setProperty('font-size', `${sizes[index] * 2}px`, 'important'));
  });
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
  await enlargeText();
  const rail = page.locator('#aethergrid-intelligence-rail');
  const surface = await rail.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(surface).toBe('rgba(239, 245, 250, 0.97)');
  await rail.getByRole('button', { name: 'DEVELOPER / DIAGNOSTICS', exact: true }).click();
  const refresh = rail.getByRole('button', { name: 'Refresh provider connections' });
  await refresh.scrollIntoViewIfNeeded();
  await expect(refresh).toBeInViewport();
  await rail.getByRole('button', { name: 'OPS', exact: true }).click();
  await rail.getByRole('button', { name: 'AI', exact: true }).click();
  const message = page.getByRole('textbox', { name: 'Message TEAM' });
  await message.scrollIntoViewIfNeeded();
  await expect(message).toBeInViewport();
  await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await expect(page.locator('#aethergrid-navigation')).toBeVisible();
  await expect(page.locator('#aethergrid-navigation')).toHaveCSS('opacity', '1');
  await expect(page.locator('#aethergrid-navigation')).toHaveCSS('background-color', surface);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/production-light-navigation-enlarged.png' });
});
