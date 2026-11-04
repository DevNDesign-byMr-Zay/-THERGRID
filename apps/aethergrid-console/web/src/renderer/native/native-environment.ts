import { weatherPhenomenon } from '../overlays/atmospheric-overlay';
import { solarStateAt } from '../solar-position';
import { rgba, mix, type Rgba } from './native-palette';
import {
  clamp,
  deterministicUnit,
  fractional,
  wrapNdc,
  nativeLayerVisible,
  type NativeFrame,
  type NativeWeatherGeometry,
  type NativeWeatherPoint,
  type NativeWeatherLine,
} from './native-frame';
export function nativeBackground(frame: NativeFrame): Rgba {
  const solar = solarStateAt(frame.time.iso, frame.target.latitude, frame.target.longitude);
  let color =
    solar.phase === 'night'
      ? rgba('#030711')
      : solar.phase === 'twilight'
        ? rgba('#0b1220')
        : solar.phase === 'golden-hour'
          ? rgba('#17151a')
          : rgba('#07111d');

  if (
    frame.time.mode === 'live' &&
    nativeLayerVisible(frame, 'air', true) &&
    frame.airQuality?.current?.usAqi != null
  ) {
    const haze = clamp(frame.airQuality.current.usAqi / 300, 0, 0.38);
    color = mix(color, rgba('#7b746e'), haze);
  }

  if (
    (frame.time.mode === 'live' || frame.time.mode === 'forecast') &&
    nativeLayerVisible(frame, 'weather', true) &&
    (frame.atmosphere?.current?.cloudCoverPercent ?? 0) > 75
  ) {
    color = mix(color, rgba('#26313b'), 0.18);
  }

  return color;
}
export function nativeDecorativeDensity(frame: NativeFrame): number {
  return frame.performanceTier === 'quality'
    ? 1
    : frame.performanceTier === 'balanced'
      ? 0.72
      : 0.42;
}
export function nativeAirGeometry(frame: NativeFrame): NativeWeatherGeometry {
  if (
    frame.time.mode !== 'live' ||
    !nativeLayerVisible(frame, 'air', true) ||
    !frame.airQuality?.current ||
    frame.airQuality.current.usAqi == null
  ) {
    return { lines: [], points: [] };
  }

  const current = frame.airQuality.current;
  const aqi = Math.max(0, current.usAqi ?? 0);
  const pm25 = Math.max(0, current.pm25UgM3 ?? 0);
  const intensity = clamp(Math.max(aqi / 220, pm25 / 80), 0.08, 1);
  const categoryColor =
    current.category === 'good'
      ? '#72e6b8'
      : current.category === 'moderate'
        ? '#e4d06c'
        : current.category === 'unhealthy-sensitive'
          ? '#e7a461'
          : current.category === 'unhealthy'
            ? '#e1766f'
            : current.category === 'very-unhealthy'
              ? '#a678d0'
              : current.category === 'hazardous'
                ? '#a96078'
                : '#9fb3c3';

  const seconds = nativeMotionPhaseSeconds(frame);
  const windFrom = current.windDirectionDegrees ?? 0;
  const toward = ((windFrom + 180) * Math.PI) / 180;
  const speed = Math.max(0, current.windSpeedKph ?? 0);
  const driftX = Math.sin(toward) * speed * 0.00012;
  const driftY = Math.cos(toward) * speed * 0.00005;
  const count = Math.max(8, Math.round((22 + intensity * 86) * nativeDecorativeDensity(frame)));
  const points: NativeWeatherPoint[] = [];

  for (let index = 0; index < count; index += 1) {
    const seedX = deterministicUnit(index, 21.41);
    const seedY = deterministicUnit(index, 27.13);
    const depth = deterministicUnit(index, 31.79);
    const x = wrapNdc(seedX * 2 - 1 + seconds * driftX);
    const y = clamp(-0.65 + seedY * 1.32 + seconds * driftY, -0.94, 0.82);
    points.push({
      position: [x, y],
      color: rgba(categoryColor, 0.025 + intensity * (0.08 + depth * 0.1)),
      size: 2.2 + intensity * 3.4 + depth * 2.2,
    });
  }

  return { lines: [], points };
}
export function nativeMotionPhaseSeconds(frame: NativeFrame): number {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return 0;
  const timestamp = Date.parse(frame.time.iso);
  return Number.isFinite(timestamp) ? timestamp / 1000 : 0;
}
export function nativeWeatherGeometry(frame: NativeFrame): NativeWeatherGeometry {
  if (
    (frame.time.mode !== 'live' && frame.time.mode !== 'forecast') ||
    !nativeLayerVisible(frame, 'weather', true) ||
    !frame.atmosphere?.current
  ) {
    return { lines: [], points: [] };
  }

  const current = frame.atmosphere.current;
  const phenomenon = weatherPhenomenon(frame.atmosphere);
  const seconds = nativeMotionPhaseSeconds(frame);
  const cloudCover = clamp(current.cloudCoverPercent ?? 0, 0, 100);
  const precipitation = Math.max(0, current.precipitationMm ?? 0);
  const windSpeed = Math.max(0, current.windSpeedKph ?? 0);
  const windFrom = current.windDirectionDegrees ?? 0;
  const windToward = ((windFrom + 180) * Math.PI) / 180;
  const windX = Math.sin(windToward);
  const windY = Math.cos(windToward);

  const lines: NativeWeatherLine[] = [];
  const points: NativeWeatherPoint[] = [];

  const cloudCount = Math.round((cloudCover / 100) * 72 * nativeDecorativeDensity(frame));
  const cloudDrift = seconds * Math.min(80, windSpeed) * 0.00016;
  for (let index = 0; index < cloudCount; index += 1) {
    const seedX = deterministicUnit(index, 3.17);
    const seedY = deterministicUnit(index, 8.41);
    const depth = deterministicUnit(index, 5.73);
    const x = wrapNdc(seedX * 2 - 1 + cloudDrift * windX);
    const y = clamp(0.2 + seedY * 0.72 + cloudDrift * windY * 0.18, -0.95, 0.96);
    points.push({
      position: [x, y],
      color: rgba('#c4d0db', 0.05 + (cloudCover / 100) * 0.16),
      size: 5 + depth * 13,
    });
  }

  const forecastPresentation =
    frame.time.mode === 'forecast' &&
    (phenomenon === 'rain' ||
      phenomenon === 'snow' ||
      phenomenon === 'thunderstorm' ||
      phenomenon === 'mixed');
  const presentationPrecipitation =
    precipitation > 0.02 ? precipitation : forecastPresentation ? 0.1 : 0;
  const precipitationActive =
    presentationPrecipitation > 0.02 &&
    (phenomenon === 'rain' ||
      phenomenon === 'snow' ||
      phenomenon === 'thunderstorm' ||
      phenomenon === 'mixed');
  if (precipitationActive) {
    const count = Math.max(
      8,
      Math.round(
        (18 + clamp(presentationPrecipitation / 8, 0, 1) * 90) * nativeDecorativeDensity(frame),
      ),
    );
    const snow = phenomenon === 'snow';
    const fallRate = snow ? 0.045 : 0.13;
    const windLean = clamp(windSpeed / 85, 0, 0.7) * windX;

    for (let index = 0; index < count; index += 1) {
      const seedX = deterministicUnit(index, 2.11);
      const seedY = deterministicUnit(index, 7.91);
      const phase = fractional(seedY + seconds * fallRate);
      const y = 1 - phase * 2;
      const x = wrapNdc(
        seedX * 2 -
          1 +
          seconds * windLean * (snow ? 0.002 : 0.0035) +
          (snow ? Math.sin(seconds * 0.7 + index) * 0.025 : 0),
      );

      if (snow) {
        points.push({
          position: [x, y],
          color: rgba('#e8f4ff', 0.42 + clamp(presentationPrecipitation / 8, 0, 1) * 0.3),
          size: 2.2 + deterministicUnit(index, 4.13) * 3,
        });
      } else {
        const length = 0.045 + clamp(presentationPrecipitation / 8, 0, 1) * 0.07;
        lines.push({
          from: [x, y],
          to: [clamp(x + windLean * length * 0.75, -1.08, 1.08), clamp(y - length, -1.08, 1.08)],
          color: rgba('#9ddcff', 0.22 + clamp(presentationPrecipitation / 8, 0, 1) * 0.42),
        });
      }
    }
  }

  if (phenomenon === 'fog') {
    const visibility = Math.max(250, current.visibilityM ?? 10_000);
    const fogStrength = 1 - clamp(visibility / 10_000, 0, 1);
    const fogCount = Math.max(
      10,
      Math.round((24 + fogStrength * 54) * nativeDecorativeDensity(frame)),
    );
    for (let index = 0; index < fogCount; index += 1) {
      const x = deterministicUnit(index, 11.23) * 2 - 1;
      const y = -0.82 + deterministicUnit(index, 13.37) * 0.62;
      points.push({
        position: [x, y],
        color: rgba('#b9c8d2', 0.05 + fogStrength * 0.16),
        size: 8 + deterministicUnit(index, 17.81) * 18,
      });
    }
  }

  return { lines, points };
}
