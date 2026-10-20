import { expect, test } from '@playwright/test';
import {
  aviationOverlay,
  mergeAviationSnapshot,
  type AviationAircraft,
  type AviationDomainState,
  type AviationProviderSnapshot
} from '../src/domains/aviation/aviation-domain';

function observedAircraft(
  longitude: number,
  latitude: number,
  observedAt: string,
  truthState: AviationAircraft['truthState'] = 'observed'
): AviationAircraft {
  return {
    id: 'aircraft-123',
    icaoHex: 'abc123',
    callsign: 'TEST123',
    operator: null,
    flightNumber: null,
    registration: null,
    aircraftType: null,
    latitude,
    longitude,
    barometricAltitudeMeters: 3_200,
    geometricAltitudeMeters: 3_240,
    groundSpeedKnots: 250,
    trackDegrees: 90,
    verticalRateFpm: 0,
    squawk: null,
    onGround: false,
    observedAt,
    truthState
  };
}

function update(
  previous: AviationDomainState | null,
  aircraft: AviationAircraft
): AviationDomainState {
  const snapshot: AviationProviderSnapshot = {
    provider: 'recorded-test-source',
    sourceTime: aircraft.observedAt,
    fetchedAt: aircraft.observedAt,
    live: true,
    stale: aircraft.truthState === 'stale',
    fallback: false,
    attribution: 'Recorded observations',
    aircraft: [aircraft],
    relationships: []
  };
  return mergeAviationSnapshot(previous, snapshot);
}

function trackLegs(
  from: AviationAircraft,
  to: AviationAircraft
) {
  const previous = update(null, from);
  const current = update(previous, to);
  return aviationOverlay(current, 'live')?.edges.filter(
    (edge) => edge.properties?.eventType === 'aircraft-history'
  ) ?? [];
}

test('aircraft trails connect nearby time-ordered recorded positions', () => {
  const legs = trackLegs(
    observedAircraft(-74, 40, '2026-10-20T14:00:00Z'),
    observedAircraft(-73.999, 40, '2026-10-20T14:00:12Z')
  );
  expect(legs).toHaveLength(1);
  expect(legs[0].properties?.sourceBacked).toBe(true);
  expect(legs[0].properties?.trackReconstruction).toBe('straight-line-observed-endpoints');
});

test('aircraft trails do not draw teleport lines across implausible observations', () => {
  expect(trackLegs(
    observedAircraft(-74, 40, '2026-10-20T14:00:00Z'),
    observedAircraft(-69, 40, '2026-10-20T14:00:10Z')
  )).toHaveLength(0);
});

test('aircraft trails do not imply continuous paths across observation gaps', () => {
  expect(trackLegs(
    observedAircraft(-74, 40, '2026-10-20T14:00:00Z'),
    observedAircraft(-73.99, 40, '2026-10-20T14:05:00Z')
  )).toHaveLength(0);
});

test('aircraft trails preserve short antimeridian crossings', () => {
  expect(trackLegs(
    observedAircraft(179.999, 0, '2026-10-20T14:00:00Z'),
    observedAircraft(-179.999, 0, '2026-10-20T14:00:25Z')
  )).toHaveLength(1);
});

test('invalid geographic fixes cannot create source-backed tracks or markers', () => {
  const previous = update(
    null,
    observedAircraft(-74, 40, '2026-10-20T14:00:00Z')
  );
  const current = update(
    previous,
    observedAircraft(-73.999, 99, '2026-10-20T14:00:12Z')
  );
  const overlay = aviationOverlay(current, 'live');
  expect(overlay?.nodes).toHaveLength(0);
  expect(overlay?.edges).toHaveLength(0);
  expect(current.history['aircraft-123']).toHaveLength(1);
});

test('interpolated or predicted positions are not labeled recorded flight tracks', () => {
  expect(trackLegs(
    observedAircraft(-74, 40, '2026-10-20T14:00:00Z'),
    observedAircraft(-73.999, 40, '2026-10-20T14:00:12Z', 'predicted')
  )).toHaveLength(0);
});
