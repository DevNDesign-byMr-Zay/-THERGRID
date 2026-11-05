import { expect, test } from '@playwright/test';

test.use({ deviceScaleFactor: 2 });

// Real maintained application + WEBGL_lose_context; software Chromium is valid
// browser evidence, never physical GPU certification. Missing WebGL is a failure.
test('native browser restores actual WebGL contexts repeatedly and releases the restored program', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const shell = page.locator('.spatial-shell');
  const switcher = page.getByRole('group', { name: 'Spatial renderer' });
  const cesium = switcher.getByRole('button', { name: 'CESIUM', exact: true });
  const modes = page.getByRole('group', { name: 'Visual mode' });
  const quality = page.getByRole('group', { name: 'Spatial graphics performance' });
  await expect(shell).toHaveAttribute('data-renderer-ready', 'true', {
    timeout: 30_000,
  });
  await page.getByText('Renderer tools', { exact: true }).click();
  await switcher.getByRole('button', { name: 'NATIVE', exact: true }).click();
  const canvas = page.locator('.native-spatial-canvas');
  await expect(canvas).toBeVisible();
  await expect(shell).toHaveAttribute('data-renderer', 'native-webgl');
  await expect(cesium).toBeEnabled();
  await expect(shell.locator('.journey-status')).toHaveCount(0);
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
      uploads: [] as number[][],
      gridRgb: null as number[] | null,
      restoredGridRgb: null as number[] | null,
    };
    (window as any).__nativeLifecycle = probe;
    const create = gl.createProgram.bind(gl),
      draw = gl.drawArrays.bind(gl),
      upload = gl.bufferData.bind(gl),
      use = gl.useProgram.bind(gl),
      dispose = gl.deleteProgram.bind(gl);
    gl.createProgram = () => {
      const program = create();
      if (program) probe.allocations.push(program);
      return program;
    };
    gl.bufferData = (target, data, usage) => {
      if (data instanceof Float32Array) probe.uploads.push(Array.from(data.subarray(0, 8)));
      if (typeof data === 'number') upload(target, data, usage);
      else upload(target, data, usage);
    };
    gl.drawArrays = (...args) => {
      probe.draws++;
      const [positions, colors] = probe.uploads;
      if (args[0] === gl.LINES && positions?.join() === '-1,-1,1,-1,-1,-1,-1,1' && colors) {
        probe.gridRgb = colors.slice(0, 3).map((channel) => Math.round(channel * 255));
      }
      probe.uploads.length = 0;
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
      // The driver's earlier listener draws before observers see a restored frame.
      probe.restoredGridRgb = probe.gridRgb;
    });
  });
  for (let cycle = 1; cycle <= 2; cycle++) {
    await page.evaluate(() => (window as any).__nativeLifecycle.extension.loseContext());
    await expect
      .poll(() => page.evaluate(() => (window as any).__nativeLifecycle.losses))
      .toBe(cycle);
    expect(await page.evaluate(() => (window as any).__nativeLifecycle.prevented)).toBe(true);
    await expect(shell).toHaveAttribute('data-renderer-ready', 'false');
    await expect(cesium).toBeDisabled();
    const before = await page.evaluate(() => (window as any).__nativeLifecycle.draws);
    await modes.getByRole('button', { name: 'XRAY', exact: true }).click();
    await quality.getByRole('button', { name: 'BAL', exact: true }).click();
    const finalMode = modes.getByRole('button', { name: cycle === 1 ? 'SOLID' : 'HOLOGRAPHIC', exact: true });
    await finalMode.click();
    await quality.getByRole('button', { name: cycle === 1 ? 'HQ' : 'ECO', exact: true }).click();
    await expect(finalMode).toHaveAttribute('aria-pressed', 'true');
    await page.setViewportSize({ width: 1100 + cycle * 20, height: 760 });
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    await expect.poll(() => canvas.evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      return canvas.width / canvas.parentElement!.clientWidth;
    })).toBe(cycle === 1 ? 2 : 1);
    expect(await page.evaluate(() => (window as any).__nativeLifecycle.draws)).toBe(before);
    await page.evaluate(() => {
      const probe = (window as any).__nativeLifecycle;
      probe.gridRgb = null;
      probe.extension.restoreContext();
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).__nativeLifecycle.restores))
      .toBe(cycle);
    await expect
      .poll(() => page.evaluate(() => (window as any).__nativeLifecycle.draws))
      .toBeGreaterThan(before);
    await expect(shell).toHaveAttribute('data-renderer-ready', 'true');
    await expect(cesium).toBeEnabled();
    expect(await page.evaluate(() => (window as any).__nativeLifecycle.restoredGridRgb))
      .toEqual(cycle === 1 ? [75, 137, 168] : [82, 207, 231]);
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
  await cesium.click();
  await expect(canvas).toHaveCount(0);
  await expect(shell).toHaveAttribute('data-renderer', 'cesium');
  await expect(shell).toHaveAttribute('data-renderer-ready', 'true');
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
