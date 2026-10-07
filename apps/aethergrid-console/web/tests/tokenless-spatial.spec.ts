import { expect, test } from '@playwright/test';

test('credential-free globe and real city mesh stay visible', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto('/');
  const shell = page.locator('.spatial-shell');
  const stage = page.locator('.world-stage');

  await expect(shell).toHaveAttribute('data-renderer-ready', 'true', {
    timeout: 30_000
  });
  await expect(shell).toHaveAttribute('data-renderer', 'cesium');
  await expect(stage).toHaveAttribute('data-spatial-scope', 'world');
  await expect(page.locator('.cesium-widget canvas').first()).toBeVisible();

  await page.waitForTimeout(3_000);
  await page.screenshot({
    path: 'test-results/credential-free-global.png',
    fullPage: true
  });

  await page
    .getByRole('navigation', { name: 'Product modes' })
    .getByRole('button', { name: 'GRID', exact: true })
    .click();

  await expect(stage).toHaveAttribute('data-spatial-scope', 'city');
  await expect
    .poll(
      async () => ({
        sourceCount: Number(
          (await stage.getAttribute('data-source-building-count')) || 0
        ),
        mode: (await shell.getAttribute('data-building-mode')) || 'none'
      }),
      {
        timeout: 75_000,
        message: 'expected a real 3D building source from Cesium OSM or source-backed OSM extrusion'
      }
    )
    .toMatchObject(
      expect.objectContaining({
        mode: expect.stringMatching(/^(cesium-osm|source-extruded|hybrid)$/)
      })
    );

  const sourceCount = Number(
    (await stage.getAttribute('data-source-building-count')) || 0
  );
  if (sourceCount > 0) {
    await expect(page.locator('.scene-caption')).toContainText('MAPPED BUILDINGS');
  }
  await expect(shell).toHaveAttribute('data-renderer', 'cesium');
  await page.waitForTimeout(8_000);
  await page.screenshot({
    path: 'test-results/credential-free-new-york-3d.png',
    fullPage: true
  });
});
