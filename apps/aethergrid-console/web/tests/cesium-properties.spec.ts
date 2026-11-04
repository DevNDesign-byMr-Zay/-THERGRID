import { expect, test } from '@playwright/test';
import { Cartesian3, Color } from 'cesium';
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
