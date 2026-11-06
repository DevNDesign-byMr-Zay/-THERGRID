import { expect, test } from '@playwright/test';

const currentFrame = '2026-10-11T12:00:00.000Z';
const laterFrame = '2026-10-11T15:00:00.000Z';

test('forecast retry loads exact samples and unrelated scene revisions retain the result', async ({
  page,
}) => {
  let forecastRequests = 0;
  await page.route('**/api/aethergrid/history?**', (route) =>
    route.fulfill({ json: { observations: [] } }),
  );
  await page.route('**/api/aethergrid/weather/forecast?**', (route) => {
    forecastRequests += 1;
    if (forecastRequests === 1) return route.fulfill({ status: 503 });
    return route.fulfill({
      json: {
        receipt: { provider: 'fixture-forecast', live: true, fallback: false },
        data: { hourly: [{ eventTime: currentFrame, temperatureC: 12 }] },
      },
    });
  });

  await page.goto('/tests/hook-harness.html?hook=weather-timeline');
  await expect(page.locator('output')).toHaveText('0');
  await page.evaluate(() => (window as any).update({ mode: 'forecast' }));
  await expect
    .poll(() => page.evaluate(() => (window as any).hook.forecastError))
    .toMatch(/HTTP 503/u);
  await page.evaluate(() => (window as any).hook.retryForecast());
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { forecastFrames, forecastAtmosphere, forecastError } = (window as any).hook;
        return { forecastFrames, eventTime: forecastAtmosphere?.eventTime, forecastError };
      }),
    )
    .toEqual({ forecastFrames: [currentFrame], eventTime: currentFrame, forecastError: null });

  await page.evaluate(() => (window as any).update({ sceneRevision: 1 }));
  await expect(page.locator('output')).toHaveText('1');
  expect(await page.evaluate(() => (window as any).hook.forecastAtmosphere.eventTime)).toBe(
    currentFrame,
  );
  expect(forecastRequests).toBe(2);
  await page.evaluate((cursorIso) => (window as any).update({ cursorIso }), laterFrame);
  await expect.poll(() => page.evaluate(() => (window as any).hook.forecastAtmosphere)).toBeNull();
  expect(forecastRequests).toBe(2);
});

test('leaving forecast aborts the request and recorded weather requires a receipt', async ({
  page,
}) => {
  const inFlight = new Promise<void>((resolve) => page.once('close', () => resolve()));
  await page.route('**/api/aethergrid/history?**', (route) =>
    route.fulfill({
      json: { observations: [{ observedAt: laterFrame }, { observedAt: currentFrame }] },
    }),
  );
  await page.route('**/api/aethergrid/weather/forecast?**', async (route) => {
    await inFlight;
    await route.abort().catch(() => undefined);
  });
  await page.route('**/api/aethergrid/weather/current?**', (route) =>
    route.fulfill({ json: { source: { live: true }, current: { temperatureC: 37 } } }),
  );

  await page.goto('/tests/hook-harness.html?hook=weather-timeline');
  await expect(page.locator('output')).toHaveText('0');
  await page.evaluate(() => (window as any).update({ mode: 'forecast' }));
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).requests.some((request: { url: string }) =>
          request.url.includes('/weather/forecast?'),
        ),
      ),
    )
    .toBe(true);
  await page.evaluate(() => (window as any).update({ mode: 'historical' }));

  await expect
    .poll(() =>
      page.evaluate(() => {
        const { hook, requests } = window as any;
        return {
          forecastAborted: requests.find((request: { url: string }) =>
            request.url.includes('/weather/forecast?'),
          )?.signal.aborted,
          forecastAtmosphere: hook.forecastAtmosphere,
          recordedFrames: hook.recordedFrames,
          recordedAtmosphere: hook.recordedAtmosphere,
          recordedError: hook.recordedError,
        };
      }),
    )
    .toEqual({
      forecastAborted: true,
      forecastAtmosphere: null,
      recordedFrames: [currentFrame, laterFrame],
      recordedAtmosphere: null,
      recordedError: 'No recorded provider observation for this time and location.',
    });
});

test('historical frame choices never reuse a different city’s observation index', async ({
  page,
}) => {
  let releaseLondon = () => {};
  const londonPending = new Promise<void>((resolve) => {
    releaseLondon = resolve;
  });
  await page.route('**/api/aethergrid/history?**', async (route) => {
    const london = new URL(route.request().url()).searchParams.get('lat') === '51.5';
    if (london) await londonPending;
    return route.fulfill({
      json: { observations: [{ observedAt: london ? laterFrame : currentFrame }] },
    });
  });
  await page.route('**/api/aethergrid/weather/current?**', (route) =>
    route.fulfill({ status: 503 }),
  );
  try {
    await page.goto('/tests/hook-harness.html?hook=weather-timeline');
    await expect(page.locator('output')).toHaveText('0');
    await page.evaluate(() => (window as any).update({ mode: 'historical' }));
    const frames = () => page.evaluate(() => (window as any).hook.recordedFrames);
    await expect.poll(frames).toEqual([currentFrame]);
    await page.evaluate(() =>
      (window as any).update({
        city: { id: 'london', latitude: 51.5, longitude: -0.12 },
      }),
    );
    await expect.poll(frames).toEqual([]);
    releaseLondon();
    await expect.poll(frames).toEqual([laterFrame]);
  } finally {
    releaseLondon();
  }
});
