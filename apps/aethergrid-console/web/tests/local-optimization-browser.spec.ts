import { expect, test } from '@playwright/test';
import { isolateBackgroundFeeds } from './helpers/isolate-background-feeds';

test('compiled Quantum panel runs a real free CPU QUBO comparison and preserves D-Wave hold', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await isolateBackgroundFeeds(page);
  // The optimizer contract reaches the actual Node CPU implementation.
  await page.route('**/api/aethergrid/quantum/optimization/local', route => route.continue());
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'QUANTUM', exact: true }).click();
  await page.getByRole('button', { name: 'LOCAL OPTIMIZE', exact: true }).click();
  await expect(page.locator('.local-qubo-workspace')).toContainText('NOT QUANTUM HARDWARE');
  await page.getByRole('button', { name: 'COMPARE LOCAL QUBO SOLVERS', exact: true }).click();
  const result = page.locator('[data-local-qubo-result="complete"]');
  await expect(result).toContainText('EXACT CPU REFERENCE');
  await expect(result).toContainText('OPTIMUM PROVEN');
  await expect(result).toContainText('OBJECTIVE GAP');
  await expect(result).toContainText('NO QUANTUM HARDWARE SUBMITTED OR EXECUTED');
  await expect(result.locator('code')).toContainText(/RESULT RECEIPT · [0-9a-f]{64}/u);
  for (const [width, height] of [[1366, 900], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const workspace = (await page.locator('.local-qubo-workspace').boundingBox())!;
    const drawer = (await page.locator('.intel-rail').boundingBox())!;
    expect(workspace.x + workspace.width, `QUBO input and receipts must fit the ${width}px operator drawer`).toBeLessThanOrEqual(drawer.x + drawer.width);
    await page.screenshot({ path: `test-results/specialist-acceptance/local-qubo-${width}.png` });
  }

  await page.locator('.local-qubo-workspace textarea').fill('{"linear":[1],"quadratic":[[2]]}');
  await page.getByRole('button', { name: 'COMPARE LOCAL QUBO SOLVERS', exact: true }).click();
  await expect(page.locator('.local-qubo-workspace [role="alert"]')).toContainText(/upper-triangle|diagonal/u);
  await expect(page.locator('[data-local-qubo-result="complete"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'ANNEAL / D-WAVE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'SUBMIT CONFIRMED D-WAVE PROBLEM' })).toBeDisabled();
});
