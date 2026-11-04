import { buildingEdges } from '../overlays/building-geometry';
import type { OverlayCoordinate } from '../overlays/spatial-overlay';
import { css, rgba, layerColor } from './native-palette';
import {
  clamp,
  projectNative,
  nativeVisualColor,
  nativeLayerVisible,
  nativeLayerOpacity,
  nativeSelectedSource,
  type NativeFrame,
  type ProjectedFeature,
} from './native-frame';
import {
  nativeWeatherGeometry,
  nativeAirGeometry,
  nativeMotionPhaseSeconds,
  nativeBackground,
} from './native-environment';
export function drawNativeCanvas(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  frame: NativeFrame,
): ProjectedFeature[] {
  const features: ProjectedFeature[] = [];

  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = css(nativeBackground(frame));
  context.fillRect(0, 0, width, height);

  const toScreen = (position: OverlayCoordinate) => {
    const projected = projectNative(frame, position);
    return [((projected[0] + 1) / 2) * width, ((1 - projected[1]) / 2) * height] as const;
  };

  if (nativeLayerVisible(frame, 'grid', true)) {
    const gridColor = nativeVisualColor(frame, rgba('#4b89a8', 0.14));
    gridColor.a *= nativeLayerOpacity(frame, 'grid');
    context.strokeStyle = css(gridColor);
    context.lineWidth = 1;
    context.beginPath();
    for (let index = -4; index <= 4; index += 1) {
      const x = ((index / 4 + 1) / 2) * width;
      const y = ((1 - index / 4) / 2) * height;
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();
  }

  const weather = nativeWeatherGeometry(frame);
  context.lineCap = 'round';
  for (const line of weather.lines) {
    context.strokeStyle = css(line.color);
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(((line.from[0] + 1) / 2) * width, ((1 - line.from[1]) / 2) * height);
    context.lineTo(((line.to[0] + 1) / 2) * width, ((1 - line.to[1]) / 2) * height);
    context.stroke();
  }
  for (const point of weather.points) {
    context.fillStyle = css(point.color);
    context.beginPath();
    context.arc(
      ((point.position[0] + 1) / 2) * width,
      ((1 - point.position[1]) / 2) * height,
      Math.max(1, point.size / 2),
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  const air = nativeAirGeometry(frame);
  for (const point of air.points) {
    context.fillStyle = css(point.color);
    context.beginPath();
    context.arc(
      ((point.position[0] + 1) / 2) * width,
      ((1 - point.position[1]) / 2) * height,
      Math.max(1, point.size / 2),
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  for (const snapshot of frame.overlays.values()) {
    if (!nativeLayerVisible(frame, snapshot.layerId, true)) continue;
    context.save();
    context.globalAlpha = nativeLayerOpacity(frame, snapshot.layerId);
    const base = nativeVisualColor(frame, layerColor(snapshot.layerId));

    for (const edge of snapshot.edges) {
      const a = toScreen(edge.from);
      const b = toScreen(edge.to);
      const windEdge = edge.kind === 'flow' && edge.properties?.vectorType === 'wind';
      const worksetGeometryEdge = edge.properties?.analysisType === 'workset-geometry';
      const scenarioModelEdge = edge.properties?.analysisType === 'scenario-model';
      const phase = nativeMotionPhaseSeconds(frame);
      const pulse = 0.5 + 0.5 * Math.sin(phase * 0.72 + (edge.intensity ?? 0.5) * 4.7);
      const selected = nativeSelectedSource(frame, snapshot.layerId, edge.id, edge.properties);
      context.strokeStyle = selected
        ? '#ffffff'
        : css(
            scenarioModelEdge
              ? rgba('#d991ff', 0.86)
              : worksetGeometryEdge
                ? rgba('#63ffc5', 0.78)
                : windEdge && frame.time.mode === 'live'
                  ? rgba('#7de9ff', 0.34 + pulse * 0.48)
                  : base,
          );
      context.lineWidth = selected
        ? 3
        : snapshot.layerId === 'energy'
          ? 1.8
          : windEdge
            ? 1.2 + (edge.intensity ?? 0.5) * 1.2
            : 1;
      context.beginPath();
      context.moveTo(a[0], a[1]);
      context.lineTo(b[0], b[1]);
      context.stroke();
    }

    for (const area of snapshot.areas ?? []) {
      const selected = nativeSelectedSource(frame, snapshot.layerId, area.id, area.properties);
      context.strokeStyle = selected
        ? '#ffffff'
        : css(nativeVisualColor(frame, layerColor(snapshot.layerId, area.kind)));
      context.lineWidth = selected ? 2.5 : 1;
      if (area.kind === 'building') {
        for (const [from, to] of buildingEdges(area)) {
          const a = toScreen(from),
            b = toScreen(to);
          context.beginPath();
          context.moveTo(a[0], a[1]);
          context.lineTo(b[0], b[1]);
          context.stroke();
        }
        continue;
      }
      context.beginPath();
      area.positions.forEach((position, index) => {
        const point = toScreen(position);
        if (index === 0) context.moveTo(point[0], point[1]);
        else context.lineTo(point[0], point[1]);
      });
      context.closePath();
      context.stroke();
    }

    for (const node of snapshot.nodes) {
      const point = projectNative(frame, node.position);
      const x = ((point[0] + 1) / 2) * width;
      const y = ((1 - point[1]) / 2) * height;
      const selected = nativeSelectedSource(frame, snapshot.layerId, node.id, node.properties);
      const urbanLight = node.properties?.presentationType === 'urban-illumination';
      const worksetGeometryNode = node.properties?.analysisType === 'workset-geometry';
      const scenarioModelNode = node.properties?.analysisType === 'scenario-model';
      const phase = nativeMotionPhaseSeconds(frame);
      const lightPulse =
        0.5 + 0.5 * Math.sin(phase * 0.12 + node.id.length * 0.71 + (node.intensity ?? 0.5) * 4.2);
      context.fillStyle = selected
        ? '#ffffff'
        : css(
            scenarioModelNode
              ? rgba('#d991ff', 0.96)
              : worksetGeometryNode
                ? rgba('#63ffc5', 0.96)
                : urbanLight
                  ? rgba('#ffd37d', 0.48 + (node.intensity ?? 0.5) * 0.22 + lightPulse * 0.2)
                  : nativeVisualColor(frame, layerColor(snapshot.layerId, node.kind)),
          );
      context.beginPath();
      context.arc(
        x,
        y,
        selected ? 6 : 3.5 + clamp(node.intensity ?? 0.5, 0, 1) * 2.5,
        0,
        Math.PI * 2,
      );
      context.fill();

      features.push({
        id: node.id,
        kind: node.kind,
        source: snapshot.attribution ?? null,
        x: point[0],
        y: point[1],
        latitude: node.position.latitude,
        longitude: node.position.longitude,
        heightMeters: node.position.heightMeters ?? 0,
        properties: {
          layerId: snapshot.layerId,
          eventTime: snapshot.eventTime,
          sourceTime: snapshot.sourceTime,
          fetchedAt: snapshot.fetchedAt,
          live: snapshot.live,
          stale: snapshot.stale,
          fallback: snapshot.fallback,
          attribution: snapshot.attribution,
          ...node.properties,
        },
      });
    }
    context.restore();
  }
  return features;
}
