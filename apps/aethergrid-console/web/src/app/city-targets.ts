import type { LayerState, SpatialTarget, VisualMode } from '../renderer/spatial-renderer';

export interface CityTarget extends SpatialTarget {
  id: string;
  name: string;
  district: string;
  custom?: boolean;
}

export const CITY_TARGETS: readonly CityTarget[] = [
  {
    id: 'new-york',
    name: 'NEW YORK',
    district: 'Midtown Manhattan',
    latitude: 40.7549,
    longitude: -73.984,
    heightMeters: 90,
    rangeMeters: 980,
    headingDegrees: 32,
    pitchDegrees: -17
  },
  {
    id: 'london',
    name: 'LONDON',
    district: 'City / South Bank',
    latitude: 51.5136,
    longitude: -0.0917,
    heightMeters: 70,
    rangeMeters: 1_050,
    headingDegrees: -24,
    pitchDegrees: -18
  },
  {
    id: 'tokyo',
    name: 'TOKYO',
    district: 'Shinjuku',
    latitude: 35.6896,
    longitude: 139.6917,
    heightMeters: 75,
    rangeMeters: 1_050,
    headingDegrees: 40,
    pitchDegrees: -17
  },
  {
    id: 'dubai',
    name: 'DUBAI',
    district: 'Downtown',
    latitude: 25.1972,
    longitude: 55.2744,
    heightMeters: 105,
    rangeMeters: 1_250,
    headingDegrees: -18,
    pitchDegrees: -15
  },
  {
    id: 'singapore',
    name: 'SINGAPORE',
    district: 'Marina Bay / Downtown Core',
    latitude: 1.2838,
    longitude: 103.8515,
    heightMeters: 70,
    rangeMeters: 1_050,
    headingDegrees: 18,
    pitchDegrees: -17
  },
  {
    id: 'sao-paulo',
    name: 'SÃO PAULO',
    district: 'Paulista / Bela Vista',
    latitude: -23.5614,
    longitude: -46.6559,
    heightMeters: 65,
    rangeMeters: 1_050,
    headingDegrees: 58,
    pitchDegrees: -18
  },
  {
    id: 'lagos',
    name: 'LAGOS',
    district: 'Victoria Island / Eko Atlantic',
    latitude: 6.4281,
    longitude: 3.4219,
    heightMeters: 55,
    rangeMeters: 1_100,
    headingDegrees: -35,
    pitchDegrees: -18
  },
  {
    id: 'sydney',
    name: 'SYDNEY',
    district: 'CBD / Circular Quay',
    latitude: -33.8651,
    longitude: 151.2099,
    heightMeters: 70,
    rangeMeters: 1_050,
    headingDegrees: 22,
    pitchDegrees: -17
  }
];

export const INITIAL_LAYERS: readonly LayerState[] = [
  { id: 'world', visible: true },
  { id: 'terrain', visible: true },
  { id: 'buildings', visible: true },
  { id: 'illumination', visible: true },
  { id: 'roads', visible: true },
  { id: 'water', visible: true },
  { id: 'green', visible: true },
  { id: 'grid', visible: true },
  { id: 'weather', visible: true },
  { id: 'weather-radar', visible: true, opacity: 0.68 },
  { id: 'air', visible: true },
  { id: 'aviation', visible: true },
  { id: 'seismic', visible: true },
  { id: 'hazards', visible: true },
  { id: 'transit', visible: true },
  { id: 'hydrology', visible: true },
  { id: 'energy', visible: true },
  { id: 'annotations', visible: true },
  { id: 'workset-analysis', visible: true },
  { id: 'scenario-model', visible: true }
];

export const VISUAL_MODES: readonly VisualMode[] = [
  'solid', 'wireframe', 'grid', 'xray', 'holographic', 'operations', 'reality'
];

export function resolveCityTarget(value: string): CityTarget | null {
  const query = value.trim();
  if (!query) return null;

  const normalized = query.toLocaleLowerCase();
  const cityMatch = CITY_TARGETS.find((target) =>
    target.name.toLocaleLowerCase().includes(normalized) ||
    target.district.toLocaleLowerCase().includes(normalized)
  );
  if (cityMatch) return cityMatch;

  const coordinateMatch = query.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/u
  );
  if (!coordinateMatch) return null;

  const latitude = Number(coordinateMatch[1]);
  const longitude = Number(coordinateMatch[2]);
  if (!(latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180)) {
    return null;
  }
  return {
    id: `coord-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
    name: 'COORDINATE',
    district: `${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`,
    latitude,
    longitude,
    rangeMeters: 5_200,
    pitchDegrees: -35,
    custom: true
  };
}
