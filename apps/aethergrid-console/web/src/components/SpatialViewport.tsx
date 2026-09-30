import type {
  AirQualityOverlaySnapshot,
  AtmosphericOverlaySnapshot
} from '../renderer/overlays/atmospheric-overlay';
import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';

import { useEffect, useRef, useState } from 'react';

import { CesiumSpatialRenderer } from '../renderer/cesium/cesium-renderer';
import { NativeWebglSpatialRenderer } from '../renderer/native/native-webgl-renderer';
import { RendererManager } from '../renderer/renderer-manager';
import type {
  LayerState,
  SpatialFeatureSelection,
  SpatialRendererStatus,
  SpatialTarget,
  TemporalInstant,
  VisualMode
} from '../renderer/spatial-renderer';
import { loadPublicRuntimeConfig } from '../services/public-runtime-config';

interface SpatialViewportProps {
  target: SpatialTarget;
  time: TemporalInstant;
  layers: readonly LayerState[];
  visualMode: VisualMode;
  overlays?: readonly SpatialOverlaySnapshot[];
  atmosphere?: AtmosphericOverlaySnapshot | null;
  airQuality?: AirQualityOverlaySnapshot | null;
  onSelection?(selection: SpatialFeatureSelection | null): void;
}

const STARTING_STATUS: SpatialRendererStatus = {
  engine: 'native-webgl',
  ready: false,
  visualMode: 'solid',
  degraded: false,
  reason: null
};

export function SpatialViewport({
  target,
  time,
  layers,
  visualMode,
  overlays = [],
  atmosphere = null,
  airQuality = null,
  onSelection
}: SpatialViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<RendererManager | null>(null);
  const overlayIdsRef = useRef<Set<string>>(new Set());
  const journeyGenerationRef = useRef(0);
  const lastJourneyKeyRef = useRef<string | null>(null);
  const [status, setStatus] = useState<SpatialRendererStatus>(STARTING_STATUS);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const manager = new RendererManager(
      new CesiumSpatialRenderer(),
      new NativeWebglSpatialRenderer()
    );
    managerRef.current = manager;
    manager.mount(host);

    void (async () => {
      const publicConfig = await loadPublicRuntimeConfig();
      const next = await manager.initialize({
        cesiumIonToken: publicConfig.spatial.cesiumIonToken,
        realityEnabled: publicConfig.spatial.realityEnabled
      });
      if (cancelled) return;
      setStatus(next);
      manager.setLayers(layers);
      manager.setVisualMode(visualMode);
      manager.setTime(time);
      for (const snapshot of overlays) manager.applyOverlay(snapshot);
      if (atmosphere) manager.applyAtmosphere(atmosphere);
      if (airQuality) manager.applyAirQuality(airQuality);
      overlayIdsRef.current = new Set(overlays.map((snapshot) => snapshot.layerId));
      const targetKey = [
        target.latitude,
        target.longitude,
        target.rangeMeters ?? '',
        target.heightMeters ?? '',
        target.pitchDegrees ?? '',
        target.headingDegrees ?? '',
        target.journey ?? ''
      ].join(':');
      lastJourneyKeyRef.current = targetKey;
      const generation = ++journeyGenerationRef.current;
      const journey = manager.flyTo(target);
      setStatus(manager.status());
      const poll = globalThis.setInterval(() => {
        if (!cancelled && generation === journeyGenerationRef.current) {
          setStatus(manager.status());
        }
      }, 120);
      await journey;
      globalThis.clearInterval(poll);
      if (!cancelled && generation === journeyGenerationRef.current) {
        setStatus(manager.status());
      }
    })().catch((error) => {
      if (cancelled) return;
      setStatus({
        engine: manager.engine,
        ready: false,
        visualMode,
        degraded: true,
        reason: error instanceof Error ? error.message : String(error)
      });
    });

    const observer = new ResizeObserver(() => manager.resize());
    observer.observe(host);

    const onPointer: EventListener = (event) => {
      const pointer = event as PointerEvent;
      const rect = host.getBoundingClientRect();
      void manager
        .pick({ x: pointer.clientX - rect.left, y: pointer.clientY - rect.top })
        .then((selection) => {
          manager.selectFeature(selection?.id ?? null);
          onSelection?.(selection);
        })
        .catch(() => onSelection?.(null));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      manager.selectFeature(null);
      onSelection?.(null);
    };

    host.addEventListener('click', onPointer);
    globalThis.addEventListener('keydown', onKeyDown);

    return () => {
      cancelled = true;
      observer.disconnect();
      host.removeEventListener('click', onPointer);
      globalThis.removeEventListener('keydown', onKeyDown);
      manager.destroy();
      if (managerRef.current === manager) managerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !status.ready) return;
    manager.setLayers(layers);
    setStatus(manager.status());
  }, [layers, status.ready]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !status.ready) return;
    manager.setVisualMode(visualMode);
    setStatus(manager.status());
  }, [visualMode, status.ready]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !status.ready) return;
    manager.setTime(time);
    setStatus(manager.status());
  }, [time, status.ready]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !status.ready) return;

    const nextIds = new Set(overlays.map((snapshot) => snapshot.layerId));
    for (const layerId of overlayIdsRef.current) {
      if (!nextIds.has(layerId)) manager.clearOverlay(layerId);
    }
    for (const snapshot of overlays) manager.applyOverlay(snapshot);
    overlayIdsRef.current = nextIds;
  }, [overlays, status.ready]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !status.ready) return;
    if (atmosphere) manager.applyAtmosphere(atmosphere);
    else manager.clearAtmosphere();
  }, [atmosphere, status.ready]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !status.ready) return;
    if (airQuality) manager.applyAirQuality(airQuality);
    else manager.clearAirQuality();
  }, [airQuality, status.ready]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !status.ready) return;

    const targetKey = [
      target.latitude,
      target.longitude,
      target.rangeMeters ?? '',
      target.heightMeters ?? '',
      target.pitchDegrees ?? '',
      target.headingDegrees ?? '',
      target.journey ?? ''
    ].join(':');
    if (lastJourneyKeyRef.current === targetKey) return;
    lastJourneyKeyRef.current = targetKey;

    const generation = ++journeyGenerationRef.current;
    const journey = manager.flyTo(target);
    setStatus(manager.status());
    const poll = globalThis.setInterval(() => {
      if (generation === journeyGenerationRef.current) {
        setStatus(manager.status());
      }
    }, 120);

    void journey
      .catch((error) => {
        setStatus({
          ...manager.status(),
          degraded: true,
          reason: error instanceof Error ? error.message : String(error)
        });
      })
      .finally(() => {
        globalThis.clearInterval(poll);
        if (generation === journeyGenerationRef.current) {
          setStatus(manager.status());
        }
      });

    return () => {
      globalThis.clearInterval(poll);
    };
  }, [target, status.ready]);

  const phaseProgress: Record<string, number> = {
    global: 25,
    regional: 50,
    city: 75,
    district: 100,
    idle: 100
  };

  return (
    <div className="spatial-shell" data-solar-phase={status.solar?.phase ?? 'unknown'}>
      <div className="spatial-canvas" ref={hostRef} aria-label="ÆTHERGRID 4D spatial viewport" />
      <div className="spatial-grid-overlay" aria-hidden="true" />
      <div className="viewport-status">
        <span className={status.ready ? 'status-dot live' : 'status-dot'} />
        <strong>{status.engine === 'cesium' ? 'CESIUM WORLD' : 'NATIVE FALLBACK'}</strong>
        <small>
          {status.ready
            ? status.degraded
              ? 'DEGRADED'
              : `${status.detailLevel?.toUpperCase() ?? 'STREAM'} · STREAMING`
            : 'INITIALIZING'}
        </small>
      </div>

      {status.busy ? (
        <div className="journey-status" data-phase={status.journeyPhase ?? 'global'}>
          <div>
            <span>SPATIAL TRANSITION</span>
            <strong>{(status.journeyPhase ?? 'global').toUpperCase()}</strong>
          </div>
          <div className="journey-progress" aria-hidden="true">
            <span
              style={{
                width: `${phaseProgress[status.journeyPhase ?? 'global'] ?? 0}%`
              }}
            />
          </div>
        </div>
      ) : null}

      {status.solar ? (
        <div className="solar-status" data-phase={status.solar.phase}>
          <span>{status.solar.phase.replace('-', ' ').toUpperCase()}</span>
          <strong>{status.solar.elevationDegrees.toFixed(1)}°</strong>
          <small>{status.solar.localSolarHour.toFixed(1)}h SOLAR</small>
        </div>
      ) : null}
      {status.reason ? <div className="viewport-warning">{status.reason}</div> : null}
    </div>
  );
}
