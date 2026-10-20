import type { OverlayCoordinate } from './spatial-overlay';

const COMPASS_DEGREES: Readonly<Record<string, number>> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315
};

export interface SkillionRoofGeometry {
  roofFaces: readonly (readonly OverlayCoordinate[])[];
  wallFaces: readonly (readonly OverlayCoordinate[])[];
}

/** S3DB roof:direction is the downslope azimuth, clockwise from north. */
export function skillionRoof(
  ring: readonly OverlayCoordinate[],
  baseOfRoofM: number,
  apexM: number,
  direction: unknown
): SkillionRoofGeometry | null {
  const input = String(direction ?? '').trim().toUpperCase();
  const azimuth = Object.hasOwn(COMPASS_DEGREES, input)
    ? COMPASS_DEGREES[input]
    : /^[0-9]+(?:[.][0-9]+)?$/u.test(input) ? Number(input) : Number.NaN;
  if (
    ring.length < 3 ||
    !Number.isFinite(azimuth) ||
    azimuth < 0 || azimuth > 360 ||
    !Number.isFinite(baseOfRoofM) ||
    !Number.isFinite(apexM) ||
    apexM <= baseOfRoofM
  ) return null;

  const radians = Math.PI / 180;
  const latitude = ring.reduce((sum, point) => sum + point.latitude, 0) / ring.length;
  const longitude = ring.reduce((sum, point) => sum + point.longitude, 0) / ring.length;
  const eastMetersPerDegree = 111_320 * Math.cos(latitude * radians);
  const northMetersPerDegree = 111_320;
  const eastComponent = Math.sin(azimuth * radians);
  const northComponent = Math.cos(azimuth * radians);
  const projections = ring.map((point) => (
    (point.longitude - longitude) * eastMetersPerDegree * eastComponent +
    (point.latitude - latitude) * northMetersPerDegree * northComponent
  ));
  const minimum = Math.min(...projections);
  const maximum = Math.max(...projections);
  const span = maximum - minimum;
  if (!Number.isFinite(span) || span < 0.01) return null;

  const roof = ring.map((point, index) => {
    const t = Math.min(1, Math.max(0, (maximum - projections[index]) / span));
    const fraction = t <= 1e-10 ? 0 : t >= 1 - 1e-10 ? 1 : t;
    return { ...point, heightMeters: baseOfRoofM + fraction * (apexM - baseOfRoofM) };
  });
  const wallFaces = roof.flatMap((first, index) => {
    const second = roof[(index + 1) % roof.length];
    if (
      first.heightMeters <= baseOfRoofM + 1e-6 &&
      second.heightMeters <= baseOfRoofM + 1e-6
    ) return [];
    return [[
      { ...ring[index], heightMeters: baseOfRoofM },
      { ...ring[(index + 1) % ring.length], heightMeters: baseOfRoofM },
      second,
      first
    ]];
  });
  return { roofFaces: [roof], wallFaces };
}
