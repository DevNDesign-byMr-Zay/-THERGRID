import { Cartesian2, Cesium3DTileFeature, Cesium3DTileset, Entity, Math as CesiumMath, type Viewer } from 'cesium';
import type { SpatialPickPoint, SpatialSurfacePoint } from '../spatial-renderer';

export function pickCesiumSurface(viewer: Pick<Viewer,'scene'|'camera'>, point: SpatialPickPoint, terrainBacked: boolean): SpatialSurfacePoint | null {
  const screen = new Cartesian2(point.x, point.y);
  const picked = viewer.scene.pick(screen);
  const entity = picked?.id;
  const properties = entity instanceof Entity ? entity.properties?.getValue() : entity?.properties;
  const analytical = properties?.authoritative === false || String(properties?.overlayKind ?? '').startsWith('analysis-') ||
    ['area-measurement', 'workset-geometry', 'scenario-model'].includes(String(properties?.analysisType ?? ''));
  const physicalSurface = !analytical && (picked instanceof Cesium3DTileFeature || picked?.primitive instanceof Cesium3DTileset ||
    entity?.aethergridSourceBuilding === true || (entity instanceof Entity && Boolean(entity.model || entity.polygon || entity.wall || entity.box)));
  // Empty scene depth can contain a previous frame or a nonphysical marker.
  // Use depth only for an identified surface, never for unclassified ground.
  let cartesian = physicalSurface && viewer.scene.pickPositionSupported ? viewer.scene.pickPosition(screen) : undefined;
  let source: SpatialSurfacePoint['source'] | null = cartesian ? 'depth-surface' : null;
  if (!cartesian && terrainBacked) {
    const ray = viewer.camera.getPickRay(screen), terrain = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
    if (terrain) { cartesian = terrain; source = 'terrain'; }
  }
  if (!cartesian) {
    const ellipsoid = viewer.camera.pickEllipsoid(screen,viewer.scene.globe.ellipsoid);
    if (ellipsoid) { cartesian = ellipsoid; source = 'ellipsoid'; }
  }
  if (!cartesian || !source) return null;
  const position = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
  if (!position) return null;
  return { latitude: CesiumMath.toDegrees(position.latitude), longitude: CesiumMath.toDegrees(position.longitude), heightMeters: position.height, source };
}
