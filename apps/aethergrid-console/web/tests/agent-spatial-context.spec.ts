import { expect, test } from '@playwright/test';
import { buildAgentSpatialContext, type AgentSpatialContextInputs } from '../src/app/agent-spatial-context';

const inputs = (): AgentSpatialContextInputs => ({
  scope: 'city',
  city: { id: 'test', name: 'TEST CITY', district: 'Fixture', latitude: 40.7, longitude: -74 },
  visualMode: 'operations',
  layers: [{ id: 'weather', visible: true }, { id: 'power', visible: false }],
  temporal: { mode: 'live', cursorIso: '2026-10-29T12:00:00.000Z' },
  activeUseCase: null,
  cityIdentity: null,
  selection: null,
  entityDossier: null,
  activeAtmosphere: null,
  liveContext: null,
  hazardContext: null,
  transitContext: null,
  hydrologyContext: null
});

test('world context excludes city-only provider evidence and retains view ordering', () => {
  const data = inputs();
  data.scope = 'world';
  data.activeAtmosphere = { live: true, current: { temperatureC: 12 } } as unknown as AgentSpatialContextInputs['activeAtmosphere'];
  data.hazardContext = { live: true, alerts: [] } as unknown as AgentSpatialContextInputs['hazardContext'];
  const result = buildAgentSpatialContext(data);
  expect(result.region).toBe('Global');
  expect(result.coordinate).toEqual({ latitude: 20, longitude: 0 });
  expect(result.environment).toBeNull();
  expect(result.hazards).toBeNull();
  expect(result.layers).toEqual([{ id: 'weather', visible: true }, { id: 'power', visible: false }]);
  expect(data.layers[0].visible).toBe(true);
});

test('current city provider snapshots preserve provenance and bounded alert/vehicle context', () => {
  const data = inputs();
  data.hazardContext = {
    live: true, stale: false, attribution: 'NWS fixture',
    alerts: Array.from({ length: 11 }, (_, index) => ({
      event: 'Alert ' + index, severity: 'Moderate',
      urgency: 'Expected', certainty: 'Likely', expires: '2026-10-30T00:00:00Z'
    }))
  } as unknown as AgentSpatialContextInputs['hazardContext'];
  data.transitContext = {
    agencyName: 'Fixture Transit', provider: 'GTFS-RT',
    sourceTime: '2026-10-29T12:00:00Z', live: true, stale: false,
    vehicles: Array.from({ length: 24 }, (_, i) => ({
      vehicleId: 'v' + i, tripId: 'trip', routeId: 'route',
      latitude: 40.7, longitude: -74, bearing: 90, speedMps: 2,
      timestamp: '2026-10-29T12:00:00Z'
    }))
  } as unknown as AgentSpatialContextInputs['transitContext'];
  data.hydrologyContext = {
    sourceTime: '2026-10-29T12:00:00Z', live: true, stale: false, partial: false,
    gauge: { gaugeId: 'g-1', name: 'Fixture', observedStageFeet: 4,
      observedFlowCfs: 100, forecastStageFeet: 5, minorFloodStageFeet: 6 }
  } as unknown as AgentSpatialContextInputs['hydrologyContext'];
  const result = buildAgentSpatialContext(data);
  expect(result.hazards?.events).toHaveLength(8);
  expect(result.hazards?.count).toBe(11);
  expect(result.hazards?.attribution).toBe('NWS fixture');
  expect(result.transit?.vehicles).toHaveLength(20);
  expect(result.transit?.vehicleCount).toBe(24);
  expect(result.hydrology?.gaugeId).toBe('g-1');
  expect(result.hydrology?.observedFlowCfs).toBe(100);
});

test('forecast and historical contexts cannot mislabel current-only feeds as live', () => {
  for (const mode of ['forecast', 'historical', 'scenario'] as const) {
    const data = inputs();
    data.temporal.mode = mode;
    data.activeAtmosphere = {
      sourceTime: '2026-10-29T12:00:00Z', live: true, stale: false,
      current: { temperatureC: 10 }
    } as unknown as AgentSpatialContextInputs['activeAtmosphere'];
    data.hazardContext = { live: true, alerts: [] } as unknown as AgentSpatialContextInputs['hazardContext'];
    data.transitContext = { live: true, vehicles: [] } as unknown as AgentSpatialContextInputs['transitContext'];
    const result = buildAgentSpatialContext(data);
    expect(result.environment?.live).toBe(false);
    expect(result.environment?.forecast).toBe(mode === 'forecast');
    expect(result.hazards).toBeNull();
    expect(result.transit).toBeNull();
    expect(result.liveContext).toBeNull();
    expect(result.hydrology).toBeNull();
  }
});

test('identity and dossier metadata remain source-linked instead of invented', () => {
  const data = inputs();
  data.selection = {
    id: 'building-1', kind: 'building', source: 'Overture fixture',
    latitude: 40.7, longitude: -74, properties: { levels: 8 },
    identity: {
      canonicalId: 'gers-1', sceneId: 'building-1', sourceId: 'source-1',
      sourceFeatureId: 'source-building', displayName: 'Fixture', kind: 'building',
      source: 'Overture fixture', layerId: 'buildings', basis: 'gers',
      gersId: 'gers-1', osmId: null, crossSourceJoinReady: true
    }
  };
  data.entityDossier = {
    entity: { canonicalId: 'gers-1' }, frozen: true, entitySource: { state: 'mapped' },
    coverage: { percent: 50 }, temporal: { mode: 'historical' },
    matchingObservations: [{ slot: 'A' }, { slot: 'B' }],
    limitations: ['Not an operational dependency']
  } as unknown as AgentSpatialContextInputs['entityDossier'];
  const result = buildAgentSpatialContext(data);
  expect(result.selectedEntity?.canonicalId).toBe('gers-1');
  expect(result.selectedEntity?.crossSourceJoinReady).toBe(true);
  expect(result.selectedEntity?.properties).toEqual({ levels: 8 });
  expect(result.entityDossier?.matchingObservationSlots).toEqual(['A', 'B']);
  expect(result.entityDossier?.limitations).toContain('Not an operational dependency');
});
