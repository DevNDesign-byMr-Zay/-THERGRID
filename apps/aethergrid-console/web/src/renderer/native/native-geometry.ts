import { buildingEdges } from '../overlays/building-geometry';
import type { OverlayCoordinate } from '../overlays/spatial-overlay';
import { rgba, layerColor, hazardHex, hydrologyHex, type Rgba } from './native-palette';
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
} from './native-environment';
export interface NativeGeometry {
  linePositions: number[];
  lineColors: number[];
  pointPositions: number[];
  pointColors: number[];
  pointSizes: number[];
  features: ProjectedFeature[];
}
export function collectNativeGeometry(frame: NativeFrame): NativeGeometry {
  const features: ProjectedFeature[] = [];
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  const pointPositions: number[] = [];
  const pointColors: number[] = [];
  const pointSizes: number[] = [];

  const addLine = (from: OverlayCoordinate, to: OverlayCoordinate, color: Rgba) => {
    const a = projectNative(frame, from);
    const b = projectNative(frame, to);
    linePositions.push(a[0], a[1], b[0], b[1]);
    for (let index = 0; index < 2; index += 1) {
      lineColors.push(color.r, color.g, color.b, color.a);
    }
  };

  if (nativeLayerVisible(frame, 'grid', true)) {
    const grid = nativeVisualColor(frame, rgba('#4b89a8', 0.14));
    grid.a *= nativeLayerOpacity(frame, 'grid');
    for (let index = -4; index <= 4; index += 1) {
      const value = index / 4;
      linePositions.push(-1, value, 1, value, value, -1, value, 1);
      for (let repeat = 0; repeat < 4; repeat += 1) {
        lineColors.push(grid.r, grid.g, grid.b, grid.a);
      }
    }
  }

  const weather = nativeWeatherGeometry(frame);
  for (const line of weather.lines) {
    linePositions.push(line.from[0], line.from[1], line.to[0], line.to[1]);
    for (let repeat = 0; repeat < 2; repeat += 1) {
      lineColors.push(line.color.r, line.color.g, line.color.b, line.color.a);
    }
  }
  for (const point of weather.points) {
    pointPositions.push(point.position[0], point.position[1]);
    pointColors.push(point.color.r, point.color.g, point.color.b, point.color.a);
    pointSizes.push(point.size);
  }

  const air = nativeAirGeometry(frame);
  for (const point of air.points) {
    pointPositions.push(point.position[0], point.position[1]);
    pointColors.push(point.color.r, point.color.g, point.color.b, point.color.a);
    pointSizes.push(point.size);
  }

  for (const snapshot of frame.overlays.values()) {
    if (!nativeLayerVisible(frame, snapshot.layerId, true)) continue;
    const lineStart = lineColors.length;
    const pointStart = pointColors.length;
    const scenario = frame.time.mode === 'scenario' ? frame.time.scenarioVisual : null;
    const base = nativeVisualColor(frame, layerColor(snapshot.layerId));

    for (const edge of snapshot.edges) {
      let color = base;
      const windEdge = edge.kind === 'flow' && edge.properties?.vectorType === 'wind';
      const worksetGeometryEdge = edge.properties?.analysisType === 'workset-geometry';
      const scenarioModelEdge = edge.properties?.analysisType === 'scenario-model';
      const nwsBoundary = edge.properties?.eventType === 'nws-alert-boundary';
      if (nwsBoundary) {
        color = rgba(hazardHex(edge.properties?.severity), 0.88);
      } else if (scenarioModelEdge) {
        color = rgba('#d991ff', 0.86);
      } else if (worksetGeometryEdge) {
        color = rgba('#63ffc5', 0.78);
      } else if (windEdge && frame.time.mode === 'live') {
        const phase = nativeMotionPhaseSeconds(frame);
        const pulse = 0.5 + 0.5 * Math.sin(phase * 0.72 + (edge.intensity ?? 0.5) * 4.7);
        color = rgba('#7de9ff', 0.34 + pulse * 0.48);
      } else if (
        scenario &&
        snapshot.layerId === 'energy' &&
        (edge.kind === 'transmission' || edge.kind === 'distribution')
      ) {
        color =
          scenario.renewableBias > 0.25
            ? rgba('#63ffc5', 0.96)
            : scenario.weatherRisk > 0.55
              ? rgba('#ff7f6b', 0.96)
              : scenario.storageStress > 0.45
                ? rgba('#f2aa62', 0.96)
                : rgba('#ffbd73', 0.92);
        addLine(edge.from, edge.to, rgba('#91a0ad', 0.22));
      }
      if (nativeSelectedSource(frame, snapshot.layerId, edge.id, edge.properties)) {
        color = rgba('#ffffff', 1);
      }
      addLine(edge.from, edge.to, color);
    }

    for (const area of snapshot.areas ?? []) {
      const selected = nativeSelectedSource(frame, snapshot.layerId, area.id, area.properties);
      const areaColor = selected
        ? rgba('#ffffff', 0.96)
        : nativeVisualColor(frame, layerColor(snapshot.layerId, area.kind));
      if (area.kind === 'building') {
        for (const [from, to] of buildingEdges(area)) addLine(from, to, areaColor);
      } else {
        for (let index = 1; index < area.positions.length; index += 1) {
          addLine(area.positions[index - 1], area.positions[index], areaColor);
        }
      }
    }

    for (const node of snapshot.nodes) {
      const point = projectNative(frame, node.position);
      const urbanLight = node.properties?.presentationType === 'urban-illumination';
      const worksetGeometryNode = node.properties?.analysisType === 'workset-geometry';
      const scenarioModelNode = node.properties?.analysisType === 'scenario-model';
      const phase = nativeMotionPhaseSeconds(frame);
      const lightPulse =
        0.5 + 0.5 * Math.sin(phase * 0.12 + node.id.length * 0.71 + (node.intensity ?? 0.5) * 4.2);
      const operatorIncident = node.properties?.eventType === 'operator-incident';
      const incidentSeverity = String(node.properties?.severity ?? 'info');
      const incidentColor =
        incidentSeverity === 'critical'
          ? '#ff4f63'
          : incidentSeverity === 'high'
            ? '#ff806b'
            : incidentSeverity === 'medium'
              ? '#f0b45f'
              : incidentSeverity === 'low'
                ? '#e0d778'
                : '#8dc9ff';
      const nwsAlert = node.properties?.eventType === 'nws-alert';
      const gtfsVehicle = node.kind === 'transit' && node.properties?.eventType === 'gtfs-vehicle';
      const noaaGauge = node.kind === 'sensor' && node.properties?.eventType === 'noaa-nwps-gauge';
      let color = nwsAlert
        ? rgba(hazardHex(node.properties?.severity), 0.96)
        : gtfsVehicle
          ? rgba('#70e7ff', 0.96)
          : noaaGauge
            ? rgba(hydrologyHex(node.properties?.floodBand), 0.96)
            : urbanLight
              ? rgba('#ffd37d', 0.48 + (node.intensity ?? 0.5) * 0.22 + lightPulse * 0.2)
              : operatorIncident
                ? rgba(incidentColor, 0.96)
                : scenarioModelNode
                  ? rgba('#d991ff', 0.96)
                  : worksetGeometryNode
                    ? rgba('#63ffc5', 0.96)
                    : nativeVisualColor(frame, layerColor(snapshot.layerId, node.kind));
      const selected = nativeSelectedSource(frame, snapshot.layerId, node.id, node.properties);
      if (selected) color = rgba('#ffffff', 1);
      pointPositions.push(point[0], point[1]);
      pointColors.push(color.r, color.g, color.b, color.a);
      pointSizes.push(
        selected
          ? 13
          : (6 + clamp(node.intensity ?? 0.5, 0, 1) * 6) *
              (urbanLight ? 0.88 + lightPulse * 0.2 : 1),
      );
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
    const opacity = nativeLayerOpacity(frame, snapshot.layerId);
    for (let index = lineStart + 3; index < lineColors.length; index += 4)
      lineColors[index] *= opacity;
    for (let index = pointStart + 3; index < pointColors.length; index += 4)
      pointColors[index] *= opacity;
  }

  return {
    linePositions,
    lineColors,
    pointPositions,
    pointColors,
    pointSizes,
    features,
  };
}
