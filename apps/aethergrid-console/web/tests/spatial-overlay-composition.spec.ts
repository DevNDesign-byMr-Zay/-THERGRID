import { expect, test } from '@playwright/test';

import {
  composeSpatialOverlays,
  deriveCityContextOverlays,
  type CityOverlayInputs,
  type OverlayCompositionInputs
} from '../src/app/spatial-overlay-composition';
import type { AtmosphericOverlaySnapshot } from '../src/renderer/overlays/atmospheric-overlay';
import type { SpatialOverlaySnapshot } from '../src/renderer/overlays/spatial-overlay';
import type { GtfsTransitContext } from '../src/services/gtfs-transit';
import type { NoaaHydrologyContext } from '../src/services/noaa-hydrology';
import type { NwsHazardContext } from '../src/services/nws-hazards';

function overlay(id: string): SpatialOverlaySnapshot {
  return { id, layerId: id, nodes: [], edges: [], areas: [] } as unknown as SpatialOverlaySnapshot;
}

function cityInputs(): CityOverlayInputs {
  return {
    scope: 'city',
    temporalMode: 'live',
    activeAtmosphere: null,
    atmosphere: null,
    liveContext: null,
    hazardContext: null,
    transitContext: null,
    hydrologyContext: null
  };
}

function composition(scope: 'world' | 'city'): OverlayCompositionInputs {
  return {
    scope,
    worldOverlay: overlay('world'),
    aviationOverlay: overlay('aviation'),
    radarSnapshot: overlay('radar'),
    semanticOverlays: [overlay('roads'), overlay('green')],
    activeIllumination: overlay('illumination'),
    powerOverlay: overlay('power'),
    windOverlay: overlay('wind'),
    seismicOverlay: overlay('seismic'),
    hazardOverlay: overlay('hazards'),
    transitOverlay: overlay('transit'),
    hydrologyOverlay: overlay('hydrology'),
    incidentOverlay: overlay('incidents'),
    worksetGeometryOverlay: overlay('workset'),
    operatorScenarioOverlay: overlay('scenario'),
    measurementOverlay: overlay('measurement')
  };
}

test('live city source overlays preserve provider snapshots and reject fallbacks', () => {
  const hazards = overlay('nws');
  const transit = overlay('gtfs');
  const water = overlay('nwps');
  const inputs = cityInputs();
  inputs.hazardContext = { fallback: false, overlay: hazards } as NwsHazardContext;
  inputs.transitContext = {
    fallback: false,
    unconfigured: false,
    overlay: transit
  } as GtfsTransitContext;
  inputs.hydrologyContext = { fallback: false, overlay: water } as NoaaHydrologyContext;

  const active = deriveCityContextOverlays(inputs);
  expect(active.hazardOverlay).toBe(hazards);
  expect(active.transitOverlay).toBe(transit);
  expect(active.hydrologyOverlay).toBe(water);

  expect(
    deriveCityContextOverlays({
      ...inputs,
      hazardContext: { fallback: true, overlay: hazards } as NwsHazardContext,
      transitContext: {
        fallback: false,
        unconfigured: true,
        overlay: transit
      } as GtfsTransitContext,
      hydrologyContext: { fallback: true, overlay: water } as NoaaHydrologyContext
    })
  ).toMatchObject({
    hazardOverlay: null,
    transitOverlay: null,
    hydrologyOverlay: null
  });
});

test('historical and forecast frames withhold current-only city provider overlays', () => {
  const inputs = cityInputs();
  inputs.hazardContext = {
    fallback: false,
    overlay: overlay('nws')
  } as NwsHazardContext;
  inputs.transitContext = {
    fallback: false,
    unconfigured: false,
    overlay: overlay('gtfs')
  } as GtfsTransitContext;
  inputs.hydrologyContext = {
    fallback: false,
    overlay: overlay('nwps')
  } as NoaaHydrologyContext;
  for (const temporalMode of ['historical', 'forecast'] as const) {
    const values = deriveCityContextOverlays({ ...inputs, temporalMode });
    expect(values.hazardOverlay).toBeNull();
    expect(values.transitOverlay).toBeNull();
    expect(values.hydrologyOverlay).toBeNull();
    expect(values.seismicOverlay).toBeNull();
    expect(values.airQualityOverlay).toBeNull();
  }
});

test('wind vectors remain modeled overlays in city non-live temporal frames', () => {
  const wind = {
    coordinate: { latitude: 40.7, longitude: -74 },
    current: { windSpeedKph: 18, windDirectionDegrees: 90 }
  } as AtmosphericOverlaySnapshot;
  for (const temporalMode of ['live', 'historical', 'forecast'] as const) {
    const values = deriveCityContextOverlays({
      ...cityInputs(),
      activeAtmosphere: wind,
      temporalMode
    });
    expect(values.windOverlay?.edges.length).toBe(27);
  }
  expect(
    deriveCityContextOverlays({ ...cityInputs(), scope: 'world', activeAtmosphere: wind })
      .windOverlay
  ).toBeNull();
});

test('world scene excludes city layers while retaining global incident evidence', () => {
  const values = composeSpatialOverlays(composition('world'));
  expect(values.map((x) => x.id)).toEqual([
    'aviation', 'radar', 'world', 'incidents', 'workset', 'scenario', 'measurement'
  ]);
  expect(values.find((x) => x.id === 'power')).toBeUndefined();
});

test('city scene preserves layer precedence, reference identity, and null omission', () => {
  const options = composition('city');
  const first = options.semanticOverlays;
  options.hazardOverlay = null;
  options.aviationOverlay = null;
  const result = composeSpatialOverlays(options);
  expect(result.map((x) => x.id)).toEqual([
    'radar', 'roads', 'green', 'illumination', 'power', 'wind',
    'seismic', 'transit', 'hydrology', 'incidents', 'workset', 'scenario', 'measurement'
  ]);
  expect(result[1]).toBe(first[0]);
  expect(options.semanticOverlays).toHaveLength(2);
});
