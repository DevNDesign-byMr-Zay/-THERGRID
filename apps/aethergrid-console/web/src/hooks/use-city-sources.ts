import { useEffect, useRef, useState, type RefObject } from 'react';
import type { CityTarget } from '../app/city-targets';
import type { SpatialViewportHandle } from '../components/SpatialViewport';
import type { AtmosphericOverlaySnapshot } from '../renderer/overlays/atmospheric-overlay';
import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';
import type { TemporalMode } from '../renderer/spatial-renderer';
import { loadCityEnvironment } from '../services/city-environment';
import { loadCityLiveContext, type CityLiveSnapshot } from '../services/city-live-context';
import {
  loadCameraCityTile,
  loadCitySpatialBundle,
  loadCoordinateSpatialBundle,
  type CityIdentitySummary,
  type CitySpatialBundle,
} from '../services/city-power-overlay';
import { mergeCitySpatialTiles } from '../services/city-tile-stream';
import { MAX_CITY_VIEW_TILES, ViewportCityStream } from '../services/city-viewport-stream';

interface CityLoadState {
  spatial: boolean;
  environment: boolean;
  liveContext: boolean;
}

interface CitySourcesOptions {
  city: CityTarget;
  scope: 'world' | 'city';
  mode: TemporalMode;
  reloadId: number;
  viewportRef: RefObject<SpatialViewportHandle | null>;
  onCityReset: () => void;
}

export function useCitySources({
  city,
  scope,
  mode,
  reloadId,
  viewportRef,
  onCityReset,
}: CitySourcesOptions) {
  const baseSpatialRef = useRef<CitySpatialBundle | null>(null);
  const [powerOverlay, setPowerOverlay] = useState<SpatialOverlaySnapshot | null>(null);
  const [illuminationOverlay, setIlluminationOverlay] = useState<SpatialOverlaySnapshot | null>(
    null,
  );
  const [semanticOverlays, setSemanticOverlays] = useState<readonly SpatialOverlaySnapshot[]>([]);
  const [cityIdentity, setCityIdentity] = useState<CityIdentitySummary | null>(null);
  const [streamingState, setStreamingState] = useState<{ count: number; error: string | null }>({
    count: 0,
    error: null,
  });
  const [powerOverlayError, setPowerOverlayError] = useState<string | null>(null);
  const [atmosphere, setAtmosphere] = useState<AtmosphericOverlaySnapshot | null>(null);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [liveContext, setLiveContext] = useState<CityLiveSnapshot | null>(null);
  const [liveContextError, setLiveContextError] = useState<string | null>(null);
  const [cityLoad, setCityLoad] = useState<CityLoadState>({
    spatial: true,
    environment: true,
    liveContext: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    baseSpatialRef.current = null;
    setStreamingState({ count: 0, error: null });
    setPowerOverlay(null);
    setIlluminationOverlay(null);
    setSemanticOverlays([]);
    setCityIdentity(null);
    setPowerOverlayError(null);
    setAtmosphere(null);
    setEnvironmentError(null);
    setLiveContext(null);
    setLiveContextError(null);
    onCityReset();
    setCityLoad({
      spatial: true,
      environment: true,
      liveContext: true,
    });

    const spatialRequest = city.custom
      ? loadCoordinateSpatialBundle(city.latitude, city.longitude, city.name, controller.signal)
      : loadCitySpatialBundle(city.id, controller.signal);

    void spatialRequest
      .then((bundle) => {
        if (controller.signal.aborted) return;
        if (bundle.power.fallback || bundle.identity.sourceProvider === 'local-fallback') {
          throw new Error('Mapped city geometry unavailable · modeled fallback withheld.');
        }
        baseSpatialRef.current = bundle;
        setPowerOverlay(bundle.power);
        setIlluminationOverlay(bundle.illumination);
        setSemanticOverlays(bundle.semantics);
        setCityIdentity(bundle.identity);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPowerOverlayError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCityLoad((current) => ({ ...current, spatial: false }));
        }
      });

    void loadCityEnvironment(city.latitude, city.longitude, controller.signal)
      .then((snapshot) => {
        if (!controller.signal.aborted) setAtmosphere(snapshot);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setEnvironmentError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCityLoad((current) => ({ ...current, environment: false }));
        }
      });

    void loadCityLiveContext(city.latitude, city.longitude, controller.signal)
      .then((snapshot) => {
        if (!controller.signal.aborted) setLiveContext(snapshot);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLiveContextError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCityLoad((current) => ({ ...current, liveContext: false }));
        }
      });

    return () => controller.abort();
  }, [city.id, city.latitude, city.longitude, reloadId]);

  // The bundled/core district is always the first scene. Adjacent live tiles
  // are optional and cannot replace it, or run from the standalone HTML.
  useEffect(() => {
    if (scope !== 'city' || mode !== 'live' || window.location.protocol === 'file:') return;
    const stream = new ViewportCityStream({
      center: { id: city.id, latitude: city.latitude, longitude: city.longitude },
      load: (tile, signal) => loadCameraCityTile(tile.latitude, tile.longitude, signal),
      onChange: (loaded) => {
        const base = baseSpatialRef.current;
        if (!base) return;
        const merged = mergeCitySpatialTiles(base, loaded, { maxTiles: MAX_CITY_VIEW_TILES });
        setPowerOverlay(merged.power);
        setSemanticOverlays(merged.semantics);
        setIlluminationOverlay(merged.illumination);
        setCityIdentity(merged.identity);
        setStreamingState({ count: loaded.length, error: null });
      },
      onError: (message) => {
        setStreamingState((current) => ({ ...current, error: message }));
      },
    });
    const sample = () => {
      if (!baseSpatialRef.current) return;
      const current = viewportRef.current?.cameraSnapshot();
      if (current) void stream.sample(current);
    };
    const interval = globalThis.setInterval(sample, 1_300);
    return () => {
      globalThis.clearInterval(interval);
      stream.dispose();
      const base = baseSpatialRef.current;
      if (base) {
        setPowerOverlay(base.power);
        setSemanticOverlays(base.semantics);
        setIlluminationOverlay(base.illumination);
        setCityIdentity(base.identity);
      }
      setStreamingState({ count: 0, error: null });
    };
  }, [scope, city.id, city.latitude, city.longitude, mode]);

  return {
    powerOverlay,
    illuminationOverlay,
    semanticOverlays,
    cityIdentity,
    streamingState,
    powerOverlayError,
    atmosphere,
    environmentError,
    liveContext,
    liveContextError,
    cityLoad,
  };
}
