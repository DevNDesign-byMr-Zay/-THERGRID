import {
  CallbackPositionProperty,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  CustomDataSource,
  type Entity,
  type Viewer,
} from 'cesium';

import { edgeColor, nodeColor, scenarioColor } from '../overlays/color-mapping';
import {
  isActiveAt,
  overlayIntensity,
  type SpatialOverlaySnapshot,
} from '../overlays/spatial-overlay';
import type { TemporalInstant, VisualMode } from '../spatial-renderer';
import { BuildingOverlayPrimitives } from './building-overlay-primitives';
import { updateConstantProperty } from './constant-property';
import {
  areaEntity,
  coordinate,
  edgeEntity,
  edgeWidth,
  nodeEntity,
  overlaySourceFeatureId,
  scenarioGhostEntity,
} from './network-overlay-entities';

function provenanceProperties(
  snapshot: SpatialOverlaySnapshot
): Readonly<Record<string, unknown>> {
  return {
    layerId: snapshot.layerId,
    overlayId: snapshot.id,
    eventTime: snapshot.eventTime,
    sourceTime: snapshot.sourceTime,
    fetchedAt: snapshot.fetchedAt,
    live: snapshot.live,
    stale: snapshot.stale,
    fallback: snapshot.fallback,
    attribution: snapshot.attribution
  };
}

export class NetworkOverlayLayer {
  #viewer: Viewer;
  #aircraftFixes=new Map<string,{position:Cartesian3;time:number}>();
  #source = new CustomDataSource('aethergrid-network-overlay');
  #snapshot: SpatialOverlaySnapshot | null = null;
  #nodeEntities = new Map<string, Entity>();
  #edgeEntities = new Map<string, Entity>();
  #scenarioGhostEntities = new Map<string, Entity>();
  #areaEntities = new Map<string, Entity>();
  #buildings: BuildingOverlayPrimitives;
  #areaColors = new Map<string, Color>();
  #labelColors = new Map<string, { fill: Color; outline: Color; background: Color }>();
  #modelColors = new Map<string, Color>();
  #presentation: VisualMode = 'solid';
  #opacity = 1;
  #selectedSourceFeatureId: string | null = null;
  #time: TemporalInstant | null = null;
  #visible = true;

  constructor(viewer: Viewer) {
    this.#viewer = viewer;
    this.#buildings = new BuildingOverlayPrimitives(viewer.scene);
    void this.#viewer.dataSources.add(this.#source);
  }

  apply(snapshot: SpatialOverlaySnapshot): void {
    this.#snapshot = snapshot;
    this.#buildings.clear();
    this.#source.entities.removeAll();
    this.#nodeEntities.clear();
    this.#edgeEntities.clear();
    this.#scenarioGhostEntities.clear();
    this.#areaEntities.clear();
    this.#areaColors.clear();
    this.#labelColors.clear();
    this.#modelColors.clear();
    if (this.#selectedSourceFeatureId && !(snapshot.areas ?? []).some((area) => overlaySourceFeatureId(area.id, area.properties) === this.#selectedSourceFeatureId) &&
      !snapshot.nodes.some((node) => overlaySourceFeatureId(node.id, node.properties) === this.#selectedSourceFeatureId) &&
      !snapshot.edges.some((edge) => overlaySourceFeatureId(edge.id, edge.properties) === this.#selectedSourceFeatureId)) this.#selectedSourceFeatureId = null;

    const provenance = provenanceProperties(snapshot);

    if (snapshot.layerId === 'buildings') {
      this.#buildings.apply(snapshot, provenance, this.#visible);
    }

    const nextAircraftFixes=new Map<string,{position:Cartesian3;time:number}>();
    for (const node of snapshot.nodes) {
      const entity = this.#source.entities.add(nodeEntity(node, provenance, this.#viewer));
      if(node.kind==='aircraft'){
        const fix={position:coordinate(node.position),time:Date.parse(String(node.properties?.observedAt ?? snapshot.sourceTime ?? snapshot.eventTime))};
        const previous=this.#aircraftFixes.get(node.id);
        const reduced=typeof window!=='undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if(previous && !reduced && node.properties?.truthState!=='stale' && fix.time>previous.time && fix.time-previous.time<=60000 && Cartesian3.distance(previous.position,fix.position)<50000){
          const started=performance.now();entity.position=new CallbackPositionProperty(()=>Cartesian3.lerp(previous.position,fix.position,Math.min(1,(performance.now()-started)/1000),new Cartesian3()),false);
        }
        nextAircraftFixes.set(node.id,fix);
      }
      this.#nodeEntities.set(node.id, entity);
      if (entity.label) this.#labelColors.set(node.id, {
        fill: Color.clone(entity.label.fillColor?.getValue() ?? Color.WHITE),
        outline: Color.clone(entity.label.outlineColor?.getValue() ?? Color.BLACK),
        background: Color.clone(entity.label.backgroundColor?.getValue() ?? Color.BLACK)
      });
      if (entity.model) this.#modelColors.set(node.id, Color.clone(entity.model.color?.getValue() ?? Color.WHITE));
    }
    this.#aircraftFixes=nextAircraftFixes;
    for (const edge of snapshot.edges) {
      const entity = this.#source.entities.add(edgeEntity(edge, provenance));
      this.#edgeEntities.set(edge.id, entity);

      if (
        snapshot.layerId === 'energy' &&
        (edge.kind === 'transmission' || edge.kind === 'distribution')
      ) {
        const ghost = this.#source.entities.add(
          scenarioGhostEntity(edge, provenance)
        );
        this.#scenarioGhostEntities.set(edge.id, ghost);
      }
    }
    for (const area of snapshot.areas ?? []) {
      if (area.positions.length < 3 || area.kind === 'building') continue;
      const entity = this.#source.entities.add(areaEntity(area, provenance));
      this.#areaEntities.set(area.id, entity);
      const color = (entity.polygon?.material as ColorMaterialProperty | undefined)?.color?.getValue();
      if (color) this.#areaColors.set(area.id, Color.clone(color));
    }

    this.#source.show = this.#visible && this.#opacity > 0;
    this.setPresentation(this.#presentation, this.#opacity);
    this.#viewer.scene.requestRender();
  }

  setVisible(visible: boolean): void {
    this.#visible = visible;
    this.#source.show = visible && this.#opacity > 0;
    this.#applyBuildingStyle();
    this.#viewer.scene.requestRender();
  }

  setPresentation(mode: VisualMode, opacity: number): void {
    this.#presentation = mode;
    this.#opacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
    this.#source.show = this.#visible && this.#opacity > 0;
    this.#applyBuildingStyle();
    if (this.#time) this.setTime(this.#time);
    else if (this.#snapshot) this.setTime({ iso: this.#snapshot.eventTime, mode: 'live' });
    this.#viewer.scene.requestRender();
  }

  selectSourceFeature(sourceFeatureId: string | null): void {
    this.#selectedSourceFeatureId = sourceFeatureId;
    if (this.#time) this.setTime(this.#time);
    else this.#applySelectionHighlight();
  }

  clearSelection(): void {
    if (!this.#selectedSourceFeatureId) return;
    this.#selectedSourceFeatureId = null;
    if (this.#time) this.setTime(this.#time);
    else this.#applyBuildingStyle();
  }

  setTime(time: TemporalInstant): void {
    this.#time = { ...time };
    const snapshot = this.#snapshot;
    if (!snapshot) return;

    const scenario =
      time.mode === 'scenario' ? time.scenarioVisual ?? null : null;
    const timestamp = Date.parse(time.iso);
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const temporalPhase = !reducedMotion && Number.isFinite(timestamp)
      ? timestamp / 1000
      : 0;

    for (const node of snapshot.nodes) {
      const entity = this.#nodeEntities.get(node.id);
      if (!entity) continue;

      entity.show = isActiveAt(node, time.iso);
      const point = entity.point;
      if (!point) continue;

      const intensity = overlayIntensity(node.intensity);
      const urbanLight =
        node.properties?.presentationType === 'urban-illumination';
      updateConstantProperty(point, 'outlineColor', Color.WHITE.withAlpha(.35));
      updateConstantProperty(point, 'outlineWidth', urbanLight ? 0 : node.kind === 'aircraft' ? .8 : 1.25);
      const baseSize = urbanLight
        ? 1.2 + intensity * 1.8
        : 5 + intensity * 7;
      const powerNode =
        !urbanLight &&
        (node.kind === 'generation' ||
          node.kind === 'substation' ||
          node.kind === 'asset');

      if (urbanLight) {
        const pulse =
          0.5 +
          0.5 *
            Math.sin(
              temporalPhase * 0.12 +
                node.id.length * 0.71 +
                intensity * 4.2
            );
        updateConstantProperty(point, 'pixelSize', baseSize * (0.9 + pulse * 0.34));
        updateConstantProperty(point, 'color', Color.fromCssColorString('#ffd37d').withAlpha(
            0.22 + intensity * 0.18 + pulse * 0.18
          ));
      } else if (
        time.mode === 'live' &&
        (node.kind === 'city' ||
          (node.kind === 'event' && node.properties?.eventType === 'earthquake'))
      ) {
        const pulse =
          0.5 +
          0.5 *
            Math.sin(
              temporalPhase * (node.kind === 'city' ? 0.85 : 1.7) +
                node.id.length * 0.41
            );
        const magnitudeBoost =
          node.kind === 'event'
            ? Math.max(0, Number(node.properties?.magnitude ?? node.value ?? 0)) * 0.07
            : 0;
        updateConstantProperty(point, 'pixelSize', baseSize * (0.92 + pulse * 0.34 + magnitudeBoost));
        updateConstantProperty(point, 'color', nodeColor(node).withAlpha(0.68 + pulse * 0.3));
      } else if (scenario && powerNode) {
        const pulse = 0.5 + 0.5 * Math.sin(temporalPhase * 0.32 + intensity * 5.1);
        const stressBoost = Math.max(0, scenario.stressFactor - 1);
        updateConstantProperty(point, 'pixelSize', baseSize * (1 + stressBoost * 0.9 + pulse * 0.14));
        updateConstantProperty(point, 'color', scenarioColor(scenario, intensity, 0.88 + pulse * 0.1));
      } else {
        updateConstantProperty(point, 'pixelSize', baseSize);
        updateConstantProperty(point, 'color', nodeColor(node));
      }
    }

    for (const edge of snapshot.edges) {
      const entity = this.#edgeEntities.get(edge.id);
      if (!entity) continue;

      entity.show = isActiveAt(edge, time.iso);
      const polyline = entity.polyline;
      if (!polyline) continue;

      const intensity = overlayIntensity(edge.intensity);
      const powerEdge =
        edge.kind === 'transmission' || edge.kind === 'distribution';
      const windEdge =
        edge.kind === 'flow' && edge.properties?.vectorType === 'wind';

      const ghost = this.#scenarioGhostEntities.get(edge.id);
      if (ghost) {
        ghost.show =
          Boolean(scenario) &&
          entity.show &&
          isActiveAt(edge, time.iso);
      }

      if (windEdge && time.mode === 'live') {
        const pulse = 0.5 + 0.5 * Math.sin(temporalPhase * 0.72 + intensity * 4.7);
        updateConstantProperty(polyline, 'width', edgeWidth(edge, intensity) * (0.88 + pulse * 0.34));
        polyline.material = new ColorMaterialProperty(
          Color.fromCssColorString('#7de9ff').withAlpha(0.34 + pulse * 0.48)
        );
      } else if (scenario && powerEdge) {
        const pulse = 0.5 + 0.5 * Math.sin(temporalPhase * 0.38 + intensity * 6.3);
        const stressBoost = Math.max(0, scenario.stressFactor - 1);
        updateConstantProperty(polyline, 'width', edgeWidth(edge, intensity) * (1 + stressBoost * 1.4 + pulse * 0.22));
        polyline.material = new ColorMaterialProperty(
          scenarioColor(scenario, intensity, 0.5 + pulse * 0.35)
        );
      } else {
        updateConstantProperty(polyline, 'width', edgeWidth(edge, intensity));
        polyline.material = new ColorMaterialProperty(edgeColor(edge, intensity));
      }
    }

    for (const area of snapshot.areas ?? []) {
      const entity = this.#areaEntities.get(area.id);
      if (entity) entity.show = isActiveAt(area, time.iso);
    }

    this.#applySelectionHighlight();
    this.#applyBuildingStyle();
    this.#applyEntityOpacity();
    if (this.#visible) this.#viewer.scene.requestRender();
  }

  #applyBuildingStyle(): void {
    this.#buildings.setPresentation(
      this.#presentation, this.#opacity, this.#visible, this.#selectedSourceFeatureId,
    );
  }

  #applyEntityOpacity(): void {
    for (const [id, entity] of this.#nodeEntities) {
      if (entity.point) {
        const color = entity.point.color?.getValue();
        const outline = entity.point.outlineColor?.getValue();
        if (color) updateConstantProperty(entity.point, 'color', color.withAlpha(color.alpha * this.#opacity));
        if (outline) updateConstantProperty(entity.point, 'outlineColor', outline.withAlpha(outline.alpha * this.#opacity));
      }
      const label = this.#labelColors.get(id);
      if (label && entity.label) {
        updateConstantProperty(entity.label, 'fillColor', label.fill.withAlpha(label.fill.alpha * this.#opacity));
        updateConstantProperty(entity.label, 'outlineColor', label.outline.withAlpha(label.outline.alpha * this.#opacity));
        updateConstantProperty(entity.label, 'backgroundColor', label.background.withAlpha(label.background.alpha * this.#opacity));
      }
      const model = this.#modelColors.get(id);
      if (model && entity.model) updateConstantProperty(entity.model, 'color', model.withAlpha(model.alpha * this.#opacity));
    }
    for (const entity of [...this.#edgeEntities.values(), ...this.#scenarioGhostEntities.values()]) {
      const property = (entity.polyline?.material as ColorMaterialProperty | undefined)?.color;
      const color = entity.properties?.overlayKind?.getValue() === 'scenario-baseline'
        ? Color.fromCssColorString('#91a0ad').withAlpha(.24)
        : property?.getValue();
      if (color && entity.polyline) entity.polyline.material = new ColorMaterialProperty(color.withAlpha(color.alpha * this.#opacity));
    }
    for (const [id, entity] of this.#areaEntities) {
      const color = this.#areaColors.get(id);
      if (color && entity.polygon) entity.polygon.material = new ColorMaterialProperty(color.withAlpha(color.alpha * this.#opacity));
    }
  }

  #applySelectionHighlight(): void {
    const snapshot = this.#snapshot;
    const selected = this.#selectedSourceFeatureId;
    if (!snapshot || !selected) return;

    for (const node of snapshot.nodes) {
      if (overlaySourceFeatureId(node.id, node.properties) !== selected) continue;
      const entity = this.#nodeEntities.get(node.id);
      if (!entity?.point) continue;
      const intensity = overlayIntensity(node.intensity);
      updateConstantProperty(entity.point, 'pixelSize', Math.max(12, (5 + intensity * 7) * 1.35));
      updateConstantProperty(entity.point, 'outlineColor', Color.fromCssColorString('#ffffff').withAlpha(0.98));
      updateConstantProperty(entity.point, 'outlineWidth', 2.4);
    }

    for (const edge of snapshot.edges) {
      if (overlaySourceFeatureId(edge.id, edge.properties) !== selected) continue;
      const entity = this.#edgeEntities.get(edge.id);
      if (!entity?.polyline) continue;
      const intensity = overlayIntensity(edge.intensity);
      updateConstantProperty(entity.polyline, 'width', Math.max(3.4, edgeWidth(edge, intensity) * 1.75));
      entity.polyline.material = new ColorMaterialProperty(
        Color.fromCssColorString('#ffffff').withAlpha(0.94)
      );
    }

    for (const area of snapshot.areas ?? []) {
      if (overlaySourceFeatureId(area.id, area.properties) !== selected) continue;
      const entity = this.#areaEntities.get(area.id);
      if (!entity?.polygon) continue;
      updateConstantProperty(entity.polygon, 'outlineColor', Color.fromCssColorString('#ffffff').withAlpha(0.92));
    }
  }

  provenance(): Pick<
    SpatialOverlaySnapshot,
    'id' | 'layerId' | 'eventTime' | 'sourceTime' | 'fetchedAt' | 'live' | 'stale' | 'fallback' | 'attribution'
  > | null {
    if (!this.#snapshot) return null;
    const {
      id,
      layerId,
      eventTime,
      sourceTime,
      fetchedAt,
      live,
      stale,
      fallback,
      attribution
    } = this.#snapshot;
    return { id, layerId, eventTime, sourceTime, fetchedAt, live, stale, fallback, attribution };
  }

  destroy(): void {
    this.#buildings.clear();
    this.#source.entities.removeAll();
    this.#viewer.dataSources.remove(this.#source, true);
    this.#snapshot = null;
    this.#selectedSourceFeatureId = null;
    this.#time = null;
    this.#nodeEntities.clear();
    this.#edgeEntities.clear();
    this.#scenarioGhostEntities.clear();
    this.#areaEntities.clear();
    this.#areaColors.clear();
    this.#labelColors.clear();
    this.#modelColors.clear();
  }
}
