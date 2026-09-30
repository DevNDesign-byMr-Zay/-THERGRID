import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';

import { useEffect, useRef, useState } from 'react';

import { CesiumSpatialRenderer } from '../renderer/cesium/cesium-renderer';
import { NativeSpatialRendererAdapter } from '../renderer/native/native-renderer-adapter';
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
  onSelection
}: SpatialViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<RendererManager | null>(null);
  const overlayIdsRef = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState<SpatialRendererStatus>(STARTING_STATUS);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const manager = new RendererManager(
      new CesiumSpatialRenderer(),
      new NativeSpatialRendererAdapter()
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
      overlayIdsRef.current = new Set(overlays.map((snapshot) => snapshot.layerId));
      await manager.flyTo(target);
      if (!cancelled) setStatus(manager.status());
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

    const onPointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      void manager
        .pick({ x: event.clientX - rect.left, y: event.clientY - rect.top })
        .then((selection) => onSelection?.(selection))
        .catch(() => onSelection?.(null));
    };
    host.addEventListener('dblclick', onPointer);

    return () => {
      cancelled = true;
      observer.disconnect();
      host.removeEventListener('dblclick', onPointer);
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
    void manager.flyTo(target);
  }, [target, status.ready]);

  return (
    <div className="spatial-shell">
      <div className="spatial-canvas" ref={hostRef} aria-label="ÆTHERGRID 4D spatial viewport" />
      <div className="spatial-grid-overlay" aria-hidden="true" />
      <div className="viewport-status">
        <span className={status.ready ? 'status-dot live' : 'status-dot'} />
        <strong>{status.engine === 'cesium' ? 'CESIUM WORLD' : 'NATIVE FALLBACK'}</strong>
        <small>{status.ready ? (status.degraded ? 'DEGRADED' : 'STREAMING') : 'INITIALIZING'}</small>
      </div>
      {status.reason ? <div className="viewport-warning">{status.reason}</div> : null}
    </div>
  );
}
