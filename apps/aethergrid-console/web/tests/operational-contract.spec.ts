import { expect, test } from '@playwright/test';
import { loadHydrologyGauge } from '../src/services/operational-data-client';
import { loadNoaaHydrologyContext } from '../src/services/noaa-hydrology';

test('NOAA missing flow sentinel and absent flood thresholds are withheld', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: { gaugeId: 'BATN6',
    name: 'New York Harbor at The Battery (IN MLLW)', observedAt: '2026-10-04T11:30:00Z',
    observedStageFeet: 2.5, observedFlowCfs: -999, forecastStageFeet: 6,
    minorFloodStageFeet: null }, receipt: { provider: 'noaa-nwps', live: true, fallback: false } });
  try {
    const result = await loadHydrologyGauge('BATN6');
    expect(result.metrics).toContainEqual({ label: 'STAGE', value: '2.50 ft' });
    expect(result.metrics.some((item) => item.label === 'FLOW')).toBe(false);
    expect(result.metrics.some((item) => item.label === 'MINOR FLOOD')).toBe(false);
    const spatial = await loadNoaaHydrologyContext('BATN6');
    expect(spatial.gauge.observedFlowCfs).toBeNull();
    expect(spatial.gauge.minorFloodStageFeet).toBeNull();
  } finally { globalThis.fetch = original; }
});
