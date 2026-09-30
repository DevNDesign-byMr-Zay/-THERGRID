export type SolarPhase = 'day' | 'golden-hour' | 'twilight' | 'night';

export interface SolarState {
  elevationDegrees: number;
  azimuthDegrees: number;
  localSolarHour: number;
  phase: SolarPhase;
}

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

function degrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function phaseForElevation(elevationDegrees: number): SolarPhase {
  if (elevationDegrees >= 10) return 'day';
  if (elevationDegrees >= -1) return 'golden-hour';
  if (elevationDegrees >= -6) return 'twilight';
  return 'night';
}

export function solarStateAt(
  isoTime: string,
  latitude: number,
  longitude: number
): SolarState {
  const instant = new Date(isoTime);
  if (!Number.isFinite(instant.getTime())) {
    return {
      elevationDegrees: 0,
      azimuthDegrees: 180,
      localSolarHour: 12,
      phase: 'day'
    };
  }

  const start = Date.UTC(instant.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((instant.getTime() - start) / 86_400_000);
  const utcHour =
    instant.getUTCHours() +
    instant.getUTCMinutes() / 60 +
    instant.getUTCSeconds() / 3600;

  const gamma =
    (2 * Math.PI / 365) *
    (dayOfYear - 1 + (utcHour - 12) / 24);

  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const trueSolarMinutes =
    ((utcHour * 60 + equationOfTime + 4 * longitude) % 1440 + 1440) % 1440;
  const hourAngleDegrees =
    trueSolarMinutes / 4 < 0
      ? trueSolarMinutes / 4 + 180
      : trueSolarMinutes / 4 - 180;

  const latitudeRadians = radians(latitude);
  const hourAngle = radians(hourAngleDegrees);

  const cosineZenith =
    Math.sin(latitudeRadians) * Math.sin(declination) +
    Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosineZenith)));
  const elevationDegrees = 90 - degrees(zenith);

  const azimuthRadians = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latitudeRadians) -
      Math.tan(declination) * Math.cos(latitudeRadians)
  );

  return {
    elevationDegrees,
    azimuthDegrees: normalizeDegrees(degrees(azimuthRadians) + 180),
    localSolarHour: trueSolarMinutes / 60,
    phase: phaseForElevation(elevationDegrees)
  };
}
