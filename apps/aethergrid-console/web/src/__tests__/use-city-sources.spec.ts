import { expect, test } from '@playwright/test';

test('city changes cancel superseded sources and settle each replacement source independently', async ({
  page,
}) => {
  const pending = new Promise<void>((resolve) => {
    page.once('close', () => resolve());
  });
  await page.route('**/api/aethergrid/geospatial/city/new-york?**', async (route) => {
    await pending;
    await route.abort().catch(() => undefined);
  });
  await page.route('**/api/aethergrid/weather/current?**', (route) =>
    route.fulfill({ status: 502 }),
  );
  await page.route('**/api/aethergrid/city-live?**', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/aethergrid/geospatial/city/london?**', (route) =>
    route.fulfill({
      json: {
        city: { id: 'london', lat: 51.51, lon: -0.12 },
        source: { provider: 'local-fallback', live: false },
        buildings: [],
      },
    }),
  );

  await page.goto('/tests/hook-harness.html?hook=city-sources');
  await expect(page.getByText('City sources ready')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).hook.cityLoad))
    .toEqual({
      spatial: true,
      environment: false,
      liveContext: false,
    });
  await page.evaluate(() =>
    (window as any).update({
      city: { id: 'london', latitude: 51.51, longitude: -0.12, name: 'London' },
    }),
  );

  await expect
    .poll(() =>
      page.evaluate(() => {
        const { hook, requests } = window as any;
        return {
          aborted: requests.find((request: { url: string }) =>
            request.url.includes('/city/new-york?'),
          )?.signal?.aborted,
          cityLoad: hook.cityLoad,
          identity: hook.cityIdentity,
          spatialError: hook.powerOverlayError,
          environmentError: hook.environmentError,
          hasLiveContext: Boolean(hook.liveContext),
        };
      }),
    )
    .toEqual({
      aborted: true,
      cityLoad: { spatial: false, environment: false, liveContext: false },
      identity: null,
      spatialError: 'Mapped city geometry unavailable · modeled fallback withheld.',
      environmentError: 'city environment request failed with HTTP 502',
      hasLiveContext: true,
    });
});
