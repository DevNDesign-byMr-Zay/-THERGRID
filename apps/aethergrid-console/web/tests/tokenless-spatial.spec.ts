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

  const meshResponse = await page.request.get(
    '/api/aethergrid/geospatial/city/new-york?force=1'
  );
  const meshPayload = await meshResponse.json();
  console.log(
    'AETHERGRID_CITY_MESH_DIAGNOSTIC',
    JSON.stringify({
      status: meshResponse.status(),
      source: meshPayload?.source ?? null,
      buildingCount: Array.isArray(meshPayload?.buildings)
        ? meshPayload.buildings.length
        : 0,
      skyline: meshPayload?.skylineProfile ?? null
    })
  );

  await expect
    .poll(
      async () => Number(
        (await stage.getAttribute('data-source-building-count')) || 0
      ),
      {
        timeout: 90_000,
        message: 'expected live OpenStreetMap building footprints to reach the 3D scene'
      }
    )
    .toBeGreaterThan(0);

  await expect(shell).toHaveAttribute(
    'data-building-mode',
    /^(source-extruded|hybrid)$/
  );
  await expect(page.locator('.scene-caption')).toContainText('MAPPED BUILDINGS');
  await expect(shell).toHaveAttribute('data-renderer', 'cesium');
  await page.waitForTimeout(8_000);
  await page.screenshot({
    path: 'test-results/credential-free-new-york-3d.png',
    fullPage: true
  });
});
