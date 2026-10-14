import { expect, test } from '@playwright/test';

test('profile dialog owns focus and blocks global spatial shortcuts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Operator profile' }).click();
  const profile = page.getByRole('dialog', { name: 'Operator profile' });
  await expect(profile).toBeVisible();
  await page.getByRole('button', { name: 'Close profile' }).focus();
  await page.keyboard.press('c');
  await expect(page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'GLOBAL', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-spatial-scope', 'world');
  await page.keyboard.press('Escape');
  await expect(profile).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Operator profile' })).toBeFocused();
});

test('closed desktop drawers cannot receive keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await expect(page.locator('#aethergrid-navigation')).toHaveAttribute('inert', '');
  await expect(page.locator('#aethergrid-intelligence-rail')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await expect(page.getByRole('button', { name: 'Close navigation drawer' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Navigation and layers' })).toBeFocused();
});

test('desktop drawer close buttons are not occluded by product navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await page.getByRole('button', { name: 'Close navigation drawer' }).click();
  await expect(page.locator('#aethergrid-navigation')).not.toBeVisible();
  await page.getByRole('button', { name: 'INTEL', exact: true }).click();
  await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
  await expect(page.locator('#aethergrid-intelligence-rail')).not.toBeVisible();
});

 test('profile returns to its own trigger after closing an active drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await page.getByRole('button', { name: 'Operator profile' }).click();
  await expect(page.locator('#aethergrid-navigation')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Operator profile' })).toBeFocused();
});
