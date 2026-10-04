import { expect, test } from '@playwright/test';
import { loadCityEnvironment, loadCityEnvironmentForecast } from '../src/services/city-environment';
import { weatherPhenomenon } from '../src/renderer/overlays/atmospheric-overlay';

test('Tomorrow current weather keeps units, provenance and missing values', async () => {
  const original = globalThis.fetch;
  let url = '';
  globalThis.fetch = async (input) => {
    url = String(input);
    return Response.json({ data: { observedAt: '2026-10-04T11:51:00Z', temperatureCelsius: 14.87,
      humidityPercent: 88, windSpeedMps: 4, visibilityKm: 15.4, weatherCode: 1101,
      pressureSurfaceLevelHpa: null }, receipt: { provider: 'tomorrow-io', live: true,
      stale: true, fallback: false, retrievedAt: '2026-10-04T11:51:28Z', attribution: 'Tomorrow.io Weather API' } });
  };
  try {
    const result = await loadCityEnvironment(40.75, -73.98);
    expect(url).toContain('/weather/current?');
    expect(result.current?.temperatureC).toBe(14.87);
    expect(result.current?.windSpeedKph).toBe(14.4);
    expect(result.current?.visibilityM).toBe(15400);
    expect(result.current?.surfacePressureHpa).toBeNull();
    expect(result.current?.precipitationMm).toBeNull();
    expect(result.sourceTime).toBe('2026-10-04T11:51:00.000Z');
    expect(result.stale).toBe(true);
    expect(weatherPhenomenon(result)).toBe('cloudy');
  } finally { globalThis.fetch = original; }
});

test('Tomorrow forecast converts wind and visibility without inventing accumulation', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: { timesteps: [{ time: '2026-10-04T12:00:00Z',
    temperatureCelsius: 14.2, humidityPercent: 85, weatherCode: 8000,
    values: { windSpeed: 3.7, windGust: 7.1, visibility: 15.7, rainIntensity: 2, pressureSurfaceLevel: null }
  }] }, receipt: { provider: 'tomorrow-io', live: true, fallback: false } });
  try {
    const result = await loadCityEnvironmentForecast(40.75, -73.98);
    expect(result.samples[0].windSpeedKph).toBeCloseTo(13.32);
    expect(result.samples[0].windGustsKph).toBeCloseTo(25.56);
    expect(result.samples[0].visibilityM).toBe(15700);
    expect(result.samples[0].precipitationMm).toBeNull();
    expect(result.samples[0].surfacePressureHpa).toBeNull();
    expect(weatherPhenomenon({ current: result.samples[0] } as Parameters<typeof weatherPhenomenon>[0])).toBe('thunderstorm');
  } finally { globalThis.fetch = original; }
});
