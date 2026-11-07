import { expect, test } from '@playwright/test';
import { Cartesian3, Color, PrimitiveCollection, type GeometryInstance, type Viewer } from 'cesium';
import { NetworkOverlayLayer } from '../src/renderer/cesium/network-overlay-layer';

function fixture() {
  let source: any;
  const viewer: any = {
    dataSources: {
      add(value: any) {
        source = value;
      },
      remove() {},
    },
    scene: { requestRender() {}, primitives: { remove() {} } },
    camera: { positionWC: Cartesian3.fromDegrees(0, 0, 11_800_000) },
  };
  const layer = new NetworkOverlayLayer(viewer);
  const node = (id: string, kind: string, properties: Record<string, unknown> = {}) => ({
    id,
    kind,
    label: id,
    position: { latitude: 40, longitude: -74, heightMeters: 10000 },
    validFrom: '2026-11-04T12:00:00Z',
    intensity: 0.82,
    properties: { eventType: 'aircraft', render3d: true, truthState: 'observed', ...properties },
  });
  layer.apply({
    id: 'observed',
    layerId: 'aviation',
    eventTime: '2026-11-04T12:00:00Z',
    live: true,
    stale: false,
    fallback: false,
    attribution: 'Observed source fixture',
    nodes: [node('aircraft', 'aircraft'), node('city', 'city', { eventType: 'city' })] as any,
    edges: [],
    areas: [],
  });
  const entity = (id: string) => source.entities.getById(id);
  return { layer, entity };
}

function values(entity: any) {
  return {
    position: entity.position.getValue(),
    color: entity.point.color.getValue(),
    size: entity.point.pixelSize.getValue(),
    outline: entity.point.outlineColor.getValue(),
    label: entity.label?.fillColor.getValue(),
    model: entity.model?.color.getValue(),
  };
}

test('unchanged observed aircraft ticks retain properties without dirtying the Cesium entity', () => {
  const { layer, entity } = fixture();
  try {
    const aircraft = entity('aircraft'),
      before = values(aircraft);
    const color = aircraft.point.color,
      size = aircraft.point.pixelSize;
    let changes = 0;
    aircraft.definitionChanged.addEventListener(() => changes++);
    for (let second = 1; second <= 3; second++) {
      layer.setTime({ mode: 'live', iso: `2026-11-04T12:00:0${second}Z` });
      expect(values(aircraft)).toEqual(before);
    }
    expect(
      changes,
      'A clock tick with identical display values must not invalidate aircraft graphics',
    ).toBe(0);
    expect(aircraft.point.color).toBe(color);
    expect(aircraft.point.pixelSize).toBe(size);
  } finally {
    layer.destroy();
  }
});

test('animated city pulses, opacity and temporal visibility still update real Cesium properties', () => {
  const { layer, entity } = fixture();
  try {
    const city = entity('city'),
      aircraft = entity('aircraft');
    const oldSize = city.point.pixelSize.getValue(),
      oldAlpha = aircraft.point.color.getValue().alpha;
    let changes = 0;
    city.definitionChanged.addEventListener(() => changes++);
    layer.setTime({ mode: 'live', iso: '2026-11-04T12:00:05Z' });
    expect(city.point.pixelSize.getValue()).not.toBe(oldSize);
    expect(changes).toBeGreaterThan(0);
    layer.setPresentation('solid', 0.4);
    expect(aircraft.point.color.getValue().alpha).toBeCloseTo(oldAlpha * 0.4);
    layer.selectSourceFeature('aircraft');
    expect(aircraft.point.outlineColor.getValue()).toEqual(Color.WHITE.withAlpha(0.98 * 0.4));
    expect(aircraft.point.outlineWidth.getValue()).toBe(2.4);
    layer.clearSelection();
    expect(aircraft.point.color.getValue().alpha).toBeCloseTo(oldAlpha * 0.4);
    layer.setTime({ mode: 'historical', iso: '2020-01-01T00:00:00Z' });
    expect(aircraft.show).toBe(false);
  } finally {
    layer.destroy();
  }
});

test('building picks select the entire source feature and replacing the overlay releases its primitives', () => {
  const primitives = new PrimitiveCollection();
  const viewer = {
    dataSources: { add() {}, remove() {} },
    scene: { requestRender() {}, primitives },
  } as unknown as Viewer;
  const layer = new NetworkOverlayLayer(viewer);
  const time = '2026-11-04T12:00:00Z';
  try {
    layer.apply({
      id: 'building-fixture',
      layerId: 'buildings',
      eventTime: time,
      sourceTime: time,
      fetchedAt: time,
      live: true,
      stale: false,
      fallback: false,
      attribution: 'Mapped-building fixture',
      nodes: [],
      edges: [],
      areas: [
        {
          id: 'split-building',
          kind: 'building',
          positions: [
            { longitude: -74, latitude: 40 },
            { longitude: -73.999, latitude: 40 },
            { longitude: -73.999, latitude: 40.001 },
            { longitude: -74, latitude: 40.001 },
          ],
          properties: {
            sourceFeatureId: '  osm:way:123  ',
            sourceBacked: true,
            heightM: 35,
            heightSource: 'height',
            roofShape: 'pyramidal',
            roofHeightM: 10,
          },
        },
      ],
    });

    const fill = primitives.get(0);
    const outline = primitives.get(1);
    const fillInstances = fill.geometryInstances as GeometryInstance[];
    const outlineInstances = outline.geometryInstances as GeometryInstance[];
    expect(fillInstances.length).toBeGreaterThan(1);
    expect(outlineInstances.length).toBeGreaterThan(0);
    for (const { id } of [...fillInstances, ...outlineInstances]) {
      expect(id.sourceFeatureId).toBe('osm:way:123');
      expect(id.properties.sourceTime).toBe(time);
      expect(id.properties.roofRefinement).toBe('source-tagged-pyramidal');
    }
    layer.selectSourceFeature(fillInstances[0].id.sourceFeatureId);
    expect(outlineInstances[0].attributes.color.value).toEqual(Uint8Array.of(255, 255, 255, 255));
    layer.setPresentation('wireframe', 0.5);
    expect(fill.show).toBe(false);
    expect(outline.show).toBe(true);

    layer.apply({
      id: 'empty-fixture',
      layerId: 'buildings',
      eventTime: time,
      sourceTime: null,
      fetchedAt: null,
      live: false,
      stale: false,
      fallback: false,
      nodes: [],
      edges: [],
      areas: [],
    });
    expect(primitives.length).toBe(0);
    expect(fill.isDestroyed()).toBe(true);
    expect(outline.isDestroyed()).toBe(true);
  } finally {
    layer.destroy();
    primitives.destroy();
  }
});
