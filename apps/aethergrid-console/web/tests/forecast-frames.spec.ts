import { expect, test } from '@playwright/test';
import { loadCityEnvironmentForecast, selectCityEnvironmentForecast, type AtmosphericForecastSeries } from '../src/services/city-environment';

function series(times: string[], extra: Partial<AtmosphericForecastSeries> = {}): AtmosphericForecastSeries {
  return { coordinate: { latitude: 40.75, longitude: -73.98 }, provider: 'contract-provider', dataset: 'hourly',
    fetchedAt: '2026-10-11T11:30:00Z', modelRunAt: '2026-10-11T10:00:00Z', attribution: 'OFFLINE TIMESTAMP CONTRACT',
    sourceBacked: true, stale: false, samples: times.map((time) => ({ time, temperatureC: 12 } as any)), ...extra };
}

test('forecast selection rejects synthetic gap and outside-range instants', () => {
  const data = series(['2026-10-11T12:00:00Z', '2026-10-11T15:00:00Z']);
  expect(selectCityEnvironmentForecast(data, '2026-10-11T13:00:00Z')).toBeNull();
  expect(selectCityEnvironmentForecast(data, '2026-10-11T11:59:00Z')).toBeNull();
  expect(selectCityEnvironmentForecast(data, '2026-10-11T15:00:00Z')?.eventTime).toBe('2026-10-11T15:00:00.000Z');
});

test('forecast selection withholds ambiguous local timestamps and fallback samples', () => {
  expect(selectCityEnvironmentForecast(series(['2026-10-11T12:00:00']), '2026-10-11T12:00:00Z')).toBeNull();
  expect(selectCityEnvironmentForecast(series(['2026-10-11T12:00:00Z'], { sourceBacked: false }), '2026-10-11T12:00:00Z')).toBeNull();
});

test('source frame coverage normalizes offsets, sorts, deduplicates and rejects invalid instants', async () => {
  const path = '../src/time/forecast-frames';
  const { forecastFrameInstants } = await import(path);
  expect(forecastFrameInstants(series(['2026-10-11T15:00:00Z', '2026-10-11T08:00:00-04:00', 'invalid', '2026-10-11T12:00:00Z']))).toEqual(['2026-10-11T12:00:00.000Z', '2026-10-11T15:00:00.000Z']);
  expect(forecastFrameInstants(null)).toEqual([]);
  expect(forecastFrameInstants(series(['2026-10-11T12:00:00Z'], { sourceBacked: false }))).toEqual([]);
});

test('stale source coverage remains explicit but ambiguous local time has no coverage', async () => {
  const path = '../src/time/forecast-frames';
  const { forecastFrameInstants } = await import(path);
  expect(forecastFrameInstants(series(['2026-10-11T08:00:00']))).toEqual([]);
  const data = series(['2026-10-11T08:00:00'], { stale: true, utcOffsetSeconds: -14400 });
  expect(forecastFrameInstants(data)).toEqual(['2026-10-11T12:00:00.000Z']);
  const snapshot = selectCityEnvironmentForecast(data, '2026-10-11T12:00:00Z');
  expect(snapshot?.stale).toBe(true); expect(snapshot?.live).toBe(false);
  expect(snapshot?.sourceTime).toBe('2026-10-11T12:00:00.000Z');
  expect(snapshot?.fetchedAt).toBe('2026-10-11T11:30:00Z');
});

test('forecast coverage rejects rolled calendar dates and midnight rollover', async () => {
  const path = '../src/time/forecast-frames';
  const { forecastFrameInstants } = await import(path);
  expect(forecastFrameInstants(series(['2026-02-30T12:00:00Z', '2026-10-11T24:00:00Z', '2026-10-11']))).toEqual([]);
});

test('forecast loader preserves only its own returned timezone evidence and issued receipt', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: { utcOffsetSeconds: -14400,
    source: { provider: 'contract-provider', live: true, retrievedAt: '2026-10-11T11:30:00Z' },
    hourly: [{ eventTime: '2026-10-11T08:00:00', temperatureC: 12, relativeHumidityPercent: 50, weatherCode: 0, windSpeedKph: 5 }] },
    receipt: { live: true, fallback: false, modelRunAt: null } });
  try {
    const result = await loadCityEnvironmentForecast(40.75, -73.98);
    expect(result.utcOffsetSeconds).toBe(-14400);
    expect(result.modelRunAt).toBeNull();
    expect(result.fetchedAt).toBe('2026-10-11T11:30:00Z');
  } finally { globalThis.fetch = original; }
});

test('forecast valid time cannot stand in for an unknown model-run receipt', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ source: { provider: 'contract', live: true, modelTime: '2026-10-11T12:00:00Z' },
    hourly: [{ eventTime: '2026-10-11T12:00:00Z', temperatureC: 12 }] });
  try {
    const result = await loadCityEnvironmentForecast(40, -74);
    expect(result.modelRunAt).toBeNull();
    expect(result.fetchedAt).toBeNull();
  } finally { globalThis.fetch = original; }
});

test('historical weather rejects current payloads without archive receipts',async()=>{
 const {loadCityEnvironment}=await import('../src/services/city-environment');
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({source:{live:true},current:{temperatureC:37}});
 try{await expect(loadCityEnvironment(40,-74,undefined,'2026-10-14T07:00:00Z')).rejects.toThrow('recorded observation receipt');}
 finally{globalThis.fetch=original;}
});
