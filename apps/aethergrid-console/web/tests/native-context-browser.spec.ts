import { expect, test } from '@playwright/test';

// Real maintained application + WEBGL_lose_context; software Chromium is valid
// browser evidence, never physical GPU certification. Missing WebGL is a failure.
test('native browser restores actual WebGL contexts repeatedly and releases the restored program', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true', {
    timeout: 30_000,
  });
  await page.getByText('Renderer tools', { exact: true }).click();
  await page
    .getByRole('group', { name: 'Spatial renderer' })
    .getByRole('button', { name: 'NATIVE', exact: true })
    .click();
  const canvas = page.locator('.native-spatial-canvas');
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement,
      gl = canvas.getContext('webgl');
    if (!gl) throw new Error('Browser lifecycle acceptance requires actual WebGL');
    const extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Browser lifecycle acceptance requires WEBGL_lose_context');
    const probe = {
      gl,
      extension,
      draws: 0,
      allocations: [] as WebGLProgram[],
      used: null as WebGLProgram | null,
      deletions: 0,
      losses: 0,
      prevented: false,
      restores: 0,
    };
    (window as any).__nativeLifecycle = probe;
    const create = gl.createProgram.bind(gl),
      draw = gl.drawArrays.bind(gl),
      use = gl.useProgram.bind(gl),
      dispose = gl.deleteProgram.bind(gl);
    gl.createProgram = () => {
      const program = create();
      if (program) probe.allocations.push(program);
      return program;
    };
    gl.drawArrays = (...args) => {
      probe.draws++;
      return draw(...args);
    };
    gl.useProgram = (program) => {
      probe.used = program;
      return use(program);
    };
    gl.deleteProgram = (program) => {
      probe.deletions++;
      return dispose(program);
    };
    canvas.addEventListener('webglcontextlost', (event) => {
      probe.losses++;
      probe.prevented = event.defaultPrevented;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      probe.restores++;
    });
  });
  for (let cycle = 1; cycle <= 2; cycle++) {
    await page.evaluate(() => (window as any).__nativeLifecycle.extension.loseContext());
    await expect
      .poll(() => page.evaluate(() => (window as any).__nativeLifecycle.losses))
      .toBe(cycle);
    expect(await page.evaluate(() => (window as any).__nativeLifecycle.prevented)).toBe(true);
    const before = await page.evaluate(() => (window as any).__nativeLifecycle.draws);
    await page
      .getByRole('group', { name: 'Visual mode' })
      .getByRole('button', { name: cycle === 1 ? 'SOLID' : 'HOLOGRAPHIC', exact: true })
      .click();
    await page.setViewportSize({ width: 1100 + cycle * 20, height: 760 });
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    expect(await page.evaluate(() => (window as any).__nativeLifecycle.draws)).toBe(before);
    await page.evaluate(() => (window as any).__nativeLifecycle.extension.restoreContext());
    await expect
      .poll(() => page.evaluate(() => (window as any).__nativeLifecycle.restores))
      .toBe(cycle);
    await expect
      .poll(() => page.evaluate(() => (window as any).__nativeLifecycle.draws))
      .toBeGreaterThan(before);
    expect(
      await page.evaluate(() => {
        const p = (window as any).__nativeLifecycle;
        return {
          lost: p.gl.isContextLost(),
          valid: p.gl.isProgram(p.used),
          fresh: p.used === p.allocations.at(-1),
          allocations: p.allocations.length,
          error: p.gl.getError(),
        };
      }),
    ).toEqual({ lost: false, valid: true, fresh: true, allocations: cycle, error: 0 });
  }
  await expect(
    page
      .getByRole('group', { name: 'Visual mode' })
      .getByRole('button', { name: 'HOLOGRAPHIC', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await canvas.screenshot({ path: test.info().outputPath('native-context-restored.png') });
  await page
    .getByRole('group', { name: 'Spatial renderer' })
    .getByRole('button', { name: 'CESIUM', exact: true })
    .click();
  await expect(canvas).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const p = (window as any).__nativeLifecycle;
      return {
        deletions: p.deletions,
        current: p.gl.getParameter(p.gl.CURRENT_PROGRAM),
        valid: p.gl.isProgram(p.allocations.at(-1)),
      };
    }),
  ).toEqual({ deletions: 1, current: null, valid: false });
  expect(errors).toEqual([]);
});
