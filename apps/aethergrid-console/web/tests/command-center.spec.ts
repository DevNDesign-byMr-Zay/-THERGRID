import { expect, test } from '@playwright/test';

const resolutions = [[1536, 1024], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844]];

for (const [width, height] of resolutions) {
  test(`viewport command center ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('img', { name: 'ÆTHERGRID', exact: true })).toBeVisible();
    for (const name of ['GRID', 'GLOBAL', 'HOLOGRAPHIC', 'QUANTUM', 'AI', 'EVIDENCE']) {
      await expect(page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name, exact: true })).toBeVisible();
    }
    const bounds = await page.evaluate(() => ({
      height: innerHeight, width: innerWidth,
      htmlHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      stage: document.querySelector('.world-stage')?.getBoundingClientRect().toJSON(),
      rails: [...document.querySelectorAll('.left-rail, .intel-rail')].map((rail) => ({
        overflow: getComputedStyle(rail).overflowY, height: rail.clientHeight, content: rail.scrollHeight
      }))
    }));
    expect(bounds.htmlHeight).toBeLessThanOrEqual(height);
    expect(bounds.bodyHeight).toBeLessThanOrEqual(height);
    expect(bounds.bodyWidth).toBeLessThanOrEqual(width);
    expect(bounds.stage.width).toBeGreaterThan(width * (width > 1100 ? 0.45 : 0.6));
    expect(bounds.stage.height).toBeGreaterThan(height * 0.5);
    for (const rail of bounds.rails) expect(rail.overflow).toBe('hidden');
    if (width === 1536) {
      const overflow = await page.locator('.navigation-content, .intelligence-content').evaluateAll((surfaces) => surfaces.map((surface) => surface.scrollHeight - surface.clientHeight));
      expect(overflow.every((value) => value <= 1)).toBeTruthy();
    }
    await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'AI', exact: true }).click();
    for (const name of ['AUREN', 'VÆLON', 'SOLVÆR']) {
      await expect(page.getByRole('img', { name: `${name} mark`, exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole('textbox', { name: 'Message TEAM' })).toBeVisible();
    if (width <= 1100) {
      await expect(page.getByRole('dialog', { name: 'Intelligence workspace' })).toBeVisible();
      await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
      await expect(page.getByRole('dialog', { name: 'Intelligence workspace' })).not.toBeVisible();
      await page.getByRole('button', { name: 'Navigation and layers' }).click();
      await expect(page.getByRole('dialog', { name: 'Navigation and layers' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Navigation and layers' })).not.toBeVisible();
    }
    await page.screenshot({ path: `test-results/command-center-${width}x${height}.png` });
  });
}

test('exclusive workspaces and source truth survive mode changes', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'QUANTUM', exact: true }).click();
  await expect(page.locator('.intel-quantum')).toBeVisible();
  await expect(page.locator('.intel-ai')).not.toBeVisible();
  await expect(page.locator('.entity-dossier')).not.toBeVisible();
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
  await expect(page.getByText('Connection Center', { exact: false }).first()).toBeVisible();
});

test('spatial handoff exits the active secondary inspector', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Inspector view' }).selectOption('events');
  await expect(page.locator('.temporal-event-navigator')).toBeVisible();
  await page.getByRole('group', { name: 'Spatial interaction' }).getByRole('button', { name: 'MEASURE', exact: true }).click();
  await expect(page.locator('.intel-analysis')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Inspector view' })).toHaveValue('overview');
});

test('TEAM retains real specialist contributions and provider truth', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'AI', exact: true }).click();
  await page.getByRole('textbox', { name: 'Message TEAM' }).fill('Compare spatial context, optimization tradeoffs and evidence for this city.');
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/aethergrid/team') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'SEND', exact: true }).click();
  const response = await responsePromise;
  const result = await response.json();
  await expect(page.getByText('Specialist contributions · 3', { exact: true })).toBeVisible();
  await page.getByText('Specialist contributions · 3', { exact: true }).click();
  await expect(page.locator('.agent-contributions article')).toHaveCount(3);
  await expect(page.locator('.agent-runtime')).toContainText(result.runtime.fallbackUsed ? 'FALLBACK' : 'PROVIDER');
  await expect(page.locator('.agent-runtime')).toContainText(result.runtime.provider);
});

test('global renderer remains usable with explicit engine provenance', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'GLOBAL', exact: true }).click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true', { timeout: 15_000 });
  const engine = await page.locator('.spatial-shell').getAttribute('data-renderer');
  expect(['cesium', 'native-webgl']).toContain(engine);
  await expect(page.locator('.spatial-canvas canvas')).toBeVisible();
  await expect(page.locator('.viewport-status')).toContainText(engine === 'cesium' ? 'CESIUM WORLD' : 'NATIVE FALLBACK');
  await page.getByText('Renderer tools', { exact: true }).click();
  await expect(page.getByRole('group', { name: 'Spatial graphics performance' })).toBeVisible();
  await page.getByText('Renderer tools', { exact: true }).click();
  await page.screenshot({ path: 'test-results/global-renderer-1536x1024.png' });
});

test('specialist conversations consume the actual runtime contract', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'AI', exact: true }).click();
  for (const agent of ['AUREN', 'VÆLON', 'SOLVÆR']) {
    await page.getByRole('group', { name: 'ÆTHERGRID agents' }).getByRole('button', { name: agent, exact: true }).click();
    await page.getByRole('textbox', { name: `Message ${agent}` }).fill('Describe your role and the limits of the available source evidence.');
    const pending = page.waitForResponse((response) => decodeURIComponent(response.url()).endsWith(`/api/aethergrid/agents/${agent}`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'SEND', exact: true }).click();
    const response = await pending;
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    await expect(page.locator('.agent-runtime')).toContainText(result.runtime.provider);
    await expect(page.locator('.agent-runtime')).toContainText(result.runtime.fallbackUsed ? 'FALLBACK' : 'PROVIDER');
    await expect(page.locator('.agent-message.assistant')).toBeVisible();
  }
});

test('local quantum execution never claims hardware execution', async ({ page, request }) => {
  const response = await request.get('/api/aethergrid/quantum/runtime');
  const runtime = await response.json();
  test.skip(runtime.provider !== 'local-simulator', 'Hardware jobs are never submitted during acceptance.');
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'QUANTUM', exact: true }).click();
  const pending = page.waitForResponse((response) => response.url().endsWith('/api/aethergrid/quantum/jobs') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'RUN LOCAL BELL TEST', exact: true }).click();
  const result = await (await pending).json();
  expect(result.job.provider).toBe('local-simulator');
  expect(result.evidence.details.hardwareSubmitted).toBe(false);
  expect(result.job.hardwareExecuted).toBe(false);
  await expect(page.locator('.quantum-job-state')).toContainText('COMPLETED');
});

test('compact drawers contain focus and switch exclusively', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Navigation and layers' });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'Navigation and layers' });
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close navigation drawer' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await drawer.evaluate((root) => root.contains(document.activeElement))).toBeTruthy();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close navigation drawer' })).toBeFocused();
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'AI', exact: true }).evaluate((element: HTMLElement) => element.focus());
  expect(await drawer.evaluate((root) => root.contains(document.activeElement))).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'AI', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Intelligence workspace' })).toBeVisible();
  await expect(drawer).not.toBeVisible();
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
});
