import type { RadarManifest } from '../../../providers/live-map-runtime.mjs';
import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';
export type { RadarManifest };
export async function loadWeatherRadar(signal?: AbortSignal): Promise<RadarManifest> {
  const response = await fetch('/api/aethergrid/weather/radar', {
    signal,
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw Error('Weather radar is unavailable; the base map remains available.');
  const manifest = (await response.json()) as RadarManifest;
  if (!manifest.frames?.length) throw Error('No recent observed radar frames.');
  return manifest;
}
export function radarOverlay(
  manifest: RadarManifest,
  index: number,
  coverageVisible: boolean,
): SpatialOverlaySnapshot {
  const frame = manifest.frames[Math.max(0, Math.min(manifest.frames.length - 1, index))];
  return {
    id: `radar:${frame.time}:${coverageVisible}`,
    layerId: 'weather-radar',
    eventTime: frame.time,
    sourceTime: frame.time,
    fetchedAt: manifest.fetchedAt,
    live: false,
    stale: manifest.stale,
    fallback: false,
    attribution: manifest.attribution,
    nodes: [],
    edges: [],
    raster: {
      urlTemplate: frame.urlTemplate,
      frameTime: frame.time,
      maximumLevel: manifest.maximumLevel,
      credit: manifest.attribution,
      coverageUrl: manifest.coverageUrl,
      coverageVisible,
    },
  };
}
