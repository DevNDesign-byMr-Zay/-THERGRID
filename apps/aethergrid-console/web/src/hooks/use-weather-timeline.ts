import { useEffect, useMemo, useState } from 'react';

import type { CityTarget } from '../app/city-targets';
import type { AtmosphericOverlaySnapshot } from '../renderer/overlays/atmospheric-overlay';
import type { TemporalMode } from '../renderer/spatial-renderer';
import {
  loadCityEnvironment,
  loadCityEnvironmentForecast,
  selectCityEnvironmentForecast,
  type AtmosphericForecastSeries,
} from '../services/city-environment';
import { forecastFrameInstants } from '../time/forecast-frames';

interface WeatherTimelineOptions {
  city: Pick<CityTarget, 'id' | 'latitude' | 'longitude'>;
  mode: TemporalMode;
  cursorIso: string;
}

interface ForecastResult {
  key: string;
  series?: AtmosphericForecastSeries;
  error?: string;
}

const NO_RECORDED_FRAMES: readonly string[] = [];

export function useWeatherTimeline({ city, mode, cursorIso }: WeatherTimelineOptions) {
  const { id, latitude, longitude } = city;
  const [forecastRevision, setForecastRevision] = useState(0);
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [recordedIndex, setRecordedIndex] = useState<{
    location: string;
    frames: string[];
  } | null>(null);
  const [recordedAtmosphere, setRecordedAtmosphere] = useState<AtmosphericOverlaySnapshot | null>(
    null,
  );
  const [recordedError, setRecordedError] = useState<string | null>(null);
  // Forecast identity is independent of renderer state and excludes the playback cursor.
  const forecastKey = JSON.stringify([id, latitude, longitude, forecastRevision]);
  const recordedLocation = JSON.stringify([latitude, longitude]);

  useEffect(() => {
    setForecastResult(null);
    if (mode !== 'forecast') return;

    const controller = new AbortController();
    void loadCityEnvironmentForecast(latitude, longitude, controller.signal)
      .then((series) => {
        if (!controller.signal.aborted) setForecastResult({ key: forecastKey, series });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setForecastResult({
            key: forecastKey,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => controller.abort();
  }, [latitude, longitude, mode, forecastKey]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      kind: 'weather',
      lat: String(latitude),
      lon: String(longitude),
    });
    void fetch(`/api/aethergrid/history?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`recorded weather index failed with HTTP ${response.status}`);
        return (await response.json()) as { observations: { observedAt: string }[] };
      })
      .then(({ observations }) => {
        if (!controller.signal.aborted) {
          setRecordedIndex({
            location: recordedLocation,
            frames: observations.map((item) => item.observedAt).sort(),
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setRecordedIndex(null);
      });

    return () => controller.abort();
  }, [latitude, longitude, mode, recordedLocation]);

  useEffect(() => {
    setRecordedAtmosphere(null);
    setRecordedError(null);
    if (mode !== 'historical') return;

    const controller = new AbortController();
    void loadCityEnvironment(latitude, longitude, controller.signal, cursorIso)
      .then((snapshot) => {
        if (!controller.signal.aborted) setRecordedAtmosphere({ ...snapshot, live: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRecordedError('No recorded provider observation for this time and location.');
        }
      });

    return () => controller.abort();
  }, [latitude, longitude, mode, cursorIso]);

  const activeForecast =
    mode === 'forecast' && forecastResult?.key === forecastKey ? forecastResult : null;
  const forecastSeries = activeForecast?.series ?? null;
  const forecastAtmosphere = useMemo(
    () => (forecastSeries ? selectCityEnvironmentForecast(forecastSeries, cursorIso) : null),
    [forecastSeries, cursorIso],
  );
  const forecastFrames = useMemo(() => forecastFrameInstants(forecastSeries), [forecastSeries]);

  const recordedFrames =
    recordedIndex?.location === recordedLocation ? recordedIndex.frames : NO_RECORDED_FRAMES;

  return {
    forecastSeries,
    forecastAtmosphere,
    forecastFrames,
    forecastError: activeForecast?.error ?? null,
    retryForecast: () => setForecastRevision((revision) => revision + 1),
    recordedFrames,
    recordedAtmosphere,
    recordedError,
  };
}
