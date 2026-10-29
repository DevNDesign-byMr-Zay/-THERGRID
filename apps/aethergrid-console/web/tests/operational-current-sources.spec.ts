import { expect, test } from '@playwright/test';

import { operationalCurrentSources } from '../src/services/operational-current-sources';
import type { AtmosphericOverlaySnapshot } from '../src/renderer/overlays/atmospheric-overlay';
import type { CityLiveSnapshot } from '../src/services/city-live-context';

const sampleTime = '2026-10-29T09:00:00.000Z';

function weather(): AtmosphericOverlaySnapshot {
  return {
    id: 'weather-fixture',
    coordinate: { latitude: 40.7, longitude: -74 },
    eventTime: sampleTime,
    sourceTime: sampleTime,
    fetchedAt: sampleTime,
    live: true,
    fallback: false,
    stale: false,
    attribution: 'Open-Meteo',
    timezone: 'America/New_York',
    utcOffsetSeconds: -14400,
    current: { weatherCode: 95 }
  } as AtmosphericOverlaySnapshot;
}

function currentCity(): CityLiveSnapshot {
  return {
    coordinate: { lat: 40.7, lon: -74 },
    airQuality: {
      source: {
        live: true,
        provider: 'open-meteo',
        attribution: 'Open-Meteo',
        fetchedAt: sampleTime,
        modelTime: sampleTime
      },
      current: { time: sampleTime, usAqi: 51.6 }
    },
    seismic: {
      source: {
        live: true,
        provider: 'usgs',
        attribution: 'USGS',
        fetchedAt: sampleTime,
        generatedAt: sampleTime
      },
      eventCount: 4
    }
  } as CityLiveSnapshot;
}

test('live weather, AQI and seismic summaries retain provider provenance', () => {
  const sources = operationalCurrentSources({
    temporalMode: 'live',
    atmosphere: weather(),
    liveContext: currentCity()
  });
  expect(sources.weatherCurrent).toMatchObject({
    live: true,
    provider: 'Open-Meteo',
    sourceTime: sampleTime,
    summary: 'THUNDERSTORM'
  });
  expect(sources.airQualityCurrent).toMatchObject({
    live: true,
    provider: 'open-meteo',
    sourceTime: sampleTime,
    summary: 'AQI 52'
  });
  expect(sources.seismicCurrent).toMatchObject({
    live: true,
    provider: 'usgs',
    sourceTime: sampleTime,
    summary: '4 RECENT EVENTS'
  });
});

test('forecast sources are labeled forecast without claiming live observations', () => {
  const sources = operationalCurrentSources({
    temporalMode: 'forecast',
    atmosphere: weather(),
    liveContext: null
  });
  expect(sources.weatherCurrent).toMatchObject({
    live: false,
    state: 'forecast',
    summary: 'THUNDERSTORM FORECAST'
  });
  expect(sources.airQualityCurrent).toBeNull();
  expect(sources.seismicCurrent).toBeNull();
});

test('stale source takes precedence over fallback and cannot be reported live', () => {
  const sources = operationalCurrentSources({
    temporalMode: 'forecast',
    atmosphere: { ...weather(), stale: true, fallback: true },
    liveContext: null
  });
  expect(sources.weatherCurrent).toMatchObject({ live: false, state: 'stale' });
});

test('fallback and absent data retain explicit absence rather than fake metrics', () => {
  const fallback = operationalCurrentSources({
    temporalMode: 'live',
    atmosphere: { ...weather(), fallback: true },
    liveContext: null
  });
  expect(fallback.weatherCurrent).toMatchObject({
    live: false,
    state: 'fallback'
  });
  const absent = operationalCurrentSources({
    temporalMode: 'historical',
    atmosphere: null,
    liveContext: null
  });
  expect(absent).toEqual({
    weatherCurrent: null,
    airQualityCurrent: null,
    seismicCurrent: null
  });
});
