import test from 'node:test';
import assert from 'node:assert/strict';

test('server provider boot: verifies server imports, instantiates providers, and contains no undefined objects or duplicate declarations', async () => {
  const { createProviderRegistry } = await import(
    '../apps/aethergrid-console/providers/provider-registry.mjs'
  );
  const { createTransitlandProvider } = await import(
    '../apps/aethergrid-console/providers/transitland-provider.mjs'
  );
  const { createDwaveProvider } = await import(
    '../apps/aethergrid-console/providers/dwave-provider.mjs'
  );
  const { createTomorrowWeatherProvider } = await import(
    '../apps/aethergrid-console/providers/tomorrow-weather-provider.mjs'
  );
  const { createEiaProvider } = await import(
    '../apps/aethergrid-console/providers/eia-provider.mjs'
  );
  const { createNoaaNwpsHydrologyProvider } = await import(
    '../apps/aethergrid-console/providers/noaa-nwps-provider.mjs'
  );
  const { createNwsAlertsProvider } = await import(
    '../apps/aethergrid-console/providers/nws-alerts-provider.mjs'
  );
  const { createTransitRegistry } = await import(
    '../apps/aethergrid-console/providers/transit-registry.mjs'
  );

  const registry = createProviderRegistry({ env: process.env });
  assert.ok(registry);
  assert.ok(registry.config);
  assert.ok(registry.config.providers);
  assert.ok(registry.config.futureProviders);

  const transitland = createTransitlandProvider({ apiKey: 'test-key' });
  assert.ok(transitland);
  assert.equal(typeof transitland.request, 'function');

  const dwave = createDwaveProvider({
    token: 'test-token',
    baseUrl: 'https://sapi.qpu.dwavesys.com/v2',
  });
  assert.ok(dwave);
  assert.equal(typeof dwave.request, 'function');

  const tomorrow = createTomorrowWeatherProvider({ apiKey: 'test-key' });
  assert.ok(tomorrow);

  const eia = createEiaProvider({ apiKey: 'test-key' });
  assert.ok(eia);

  const nwps = createNoaaNwpsHydrologyProvider();
  assert.ok(nwps);

  const nws = createNwsAlertsProvider();
  assert.ok(nws);

  const transit = createTransitRegistry({ feeds: {} });
  assert.ok(transit);
});
