import { expect, test } from '@playwright/test';

test('compiled Quantum workspace truthfully presents optional Qiskit Aer and keeps CPU fallback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Product modes' })
    .getByRole('button', { name: 'QUANTUM', exact: true }).click();
  await page.getByRole('button', { name: 'QISKIT AER', exact: true }).click();

  const area = page.locator('.aer-workspace');
  await expect(area).toContainText('CPU CIRCUIT SIMULATION');
  await expect(area).toContainText('not proof of optimality');
  await expect(area.getByRole('button', { name: 'BELL CIRCUIT' })).toBeVisible();
  await area.getByRole('button', { name: 'QAOA QUBO TRIAL' }).click();
  await expect(area.locator('textarea')).toHaveValue(/qubo-qaoa/u);
  await area.getByRole('button', { name: 'BELL CIRCUIT' }).click();
  await expect(area.locator('textarea')).toHaveValue(/bell/u);

  const provider = await page.request.get('/api/aethergrid/quantum/qiskit/status');
  expect(provider.ok(), 'Optional simulator status must return an honest capability response').toBe(true);
  {
    const status = await provider.json();
    if (!status.available) {
      await expect(area.locator('[data-aer-availability="unavailable"]')).toBeVisible();
      await expect(area.getByRole('button', { name: 'RUN QISKIT AER SIMULATOR' })).toBeDisabled();
    } else {
      await area.getByRole('button', { name: 'RUN QISKIT AER SIMULATOR' }).click();
      const results = area.locator('[data-aer-circuit-result="complete"]');
      await expect(results).toContainText('MEASUREMENT COUNTS');
      await expect(results).toContainText('NOT QUANTUM HARDWARE');
      for (const [width, height] of [[1366, 900], [768, 1024], [390, 844]]) {
        await page.setViewportSize({ width, height });
        const drawer = (await page.locator('.intel-rail').boundingBox())!;
        for (const detail of await results.locator('small').all()) {
          const bounds = (await detail.boundingBox())!;
          expect(bounds.x + bounds.width, `Simulator evidence must fit the ${width}px drawer`).toBeLessThanOrEqual(drawer.x + drawer.width);
        }
        await page.screenshot({ path: `test-results/specialist-acceptance/qiskit-aer-${width}.png` });
      }
    }
  }

  await page.getByRole('button', { name: 'LOCAL OPTIMIZE', exact: true }).click();
  await expect(page.locator('.local-qubo-workspace')).toBeVisible();
  await page.getByRole('button', { name: 'ANNEAL / D-WAVE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'SUBMIT CONFIRMED D-WAVE PROBLEM' })).toBeDisabled();
});
