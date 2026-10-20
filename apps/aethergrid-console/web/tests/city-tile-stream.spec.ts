import { expect, test } from '@playwright/test';
import { cameraCityTile, mergeCitySpatialTiles, type CameraCityTile } from '../src/services/city-tile-stream';
import type { CitySpatialBundle } from '../src/services/city-power-overlay';
import type { SpatialOverlaySnapshot } from '../src/renderer/overlays/spatial-overlay';

const city = { id: 'new-york', latitude: 40.7549, longitude: -73.984 };
const camera = (longitude: number, latitude = city.latitude, heightMeters = 550) => ({longitude, latitude, heightMeters});
const stream = (longitude: number, opts = {}) => cameraCityTile({
  center: city, camera: camera(longitude), ...opts
});

test('camera-driven tile selection is geographic, deterministic, near-field and excludes the core district', () => {
  expect(stream(city.longitude)).toBeNull();
  const one = stream(city.longitude + 0.0068);
  expect(one).not.toBeNull();
  expect(one!.key).toBe('new-york:1:0');
  expect(stream(city.longitude + 0.0068)).toEqual(one);
  expect(stream(city.longitude + 0.0072)).toEqual(one);
  expect(stream(city.longitude + 0.035)).toBeNull();
  expect(cameraCityTile({center:city,camera:camera(city.longitude + 0.0068,city.latitude,6000)})).toBeNull();
  expect(cameraCityTile({center:city,camera:camera(city.longitude + 0.0068,91,100)})).toBeNull();
  expect(cameraCityTile({center:city,camera:camera(Number.NaN)})).toBeNull();
});

test('tile snapping handles dateline neighbors without pathological longitude jumps', () => {
  const center = {id:'dateline', latitude: 10, longitude: 179.998};
  const result = cameraCityTile({center,camera:camera(-179.996,10,450)});
  expect(result).not.toBeNull();
  expect(result!.longitude).toBeGreaterThanOrEqual(-180);
  expect(result!.longitude).toBeLessThanOrEqual(180);
  expect(result!.key).toBe('dateline:1:0');
});

const observation = '2026-10-20T18:00:00Z';
const snapshot = (layerId: string, ids: string[], tile: string): SpatialOverlaySnapshot => ({
 id: `${layerId}:${tile}`, layerId, eventTime: observation, sourceTime: observation, fetchedAt: observation,
 live:true,stale:false,fallback:false,attribution:'© OpenStreetMap contributors',
 nodes: layerId === 'energy' || layerId === 'illumination' ? ids.map(id=>({
  id,kind:'asset' as const,position:{latitude:city.latitude,longitude:city.longitude},
  properties:{sourceFeatureId:id,cityId:tile}
 })) : [],
 edges: layerId === 'roads' ? ids.map(id=>({
  id,kind:'route' as const,from:{latitude:40,longitude:-74},to:{latitude:40.001,longitude:-74},
  properties:{sourceFeatureId:id.split(':')[0],cityId:tile}
 })) : [],
 areas: layerId === 'buildings' ? ids.map(id=>({
  id,kind:'building' as const, positions:[
    {longitude:-74,latitude:40},{longitude:-73.999,latitude:40},{longitude:-73.999,latitude:40.001},{longitude:-74,latitude:40.001}
  ],
  properties:{sourceFeatureId:id,cityId:tile,heightM:id === 'tall' ? 100 : 20,minHeightM:0,heightSource:'height'}
 })) : []
});
const bundle = (id:string, buildings:string[], roads:string[]):CitySpatialBundle => ({
 power:snapshot('energy', ['transformer'],id),
 semantics:[snapshot('buildings',buildings,id), snapshot('roads',roads,id),snapshot('water',[],id),snapshot('green',[],id)],
 illumination:snapshot('illumination',buildings,id),
 identity:{
  cityId:'new-york', district:'Midtown',buildingCount:buildings.length,maxHeightM:100,p95HeightM:100,medianHeightM:20,
  sourceBackedHeightCoveragePercent:100,explicitHeightCoveragePercent:100,estimatedHeightCoveragePercent:0,levelsDerivedHeightCoveragePercent:0,
  modeledHeightCoveragePercent:0,refinedRoofCount:0,limitedRoofCount:0,rejectedBuildingCount:0,buildingPartCount:0,
  roofTaggedCount:0,namedStructureCount:0,tallStructureCount:0,arrivalHeadingDegrees:32,namedStructures:[],
  upstreamTimestamp:observation,sourceProvider:'OpenStreetMap Overpass',live:true
 }
});

test('camera tile merger deduplicates OSM identity while retaining separate road segments and provenance', () => {
 const initial = bundle('core',['b1','b2'],['road:segment:1','road:segment:2']);
 const tiles=[{key:'new-york:1:0',bundle:bundle('east',['b2','tall'],['road:segment:1','road:segment:3'])}];
 const merged = mergeCitySpatialTiles(initial,tiles);
 const buildings = merged.semantics.find(s=>s.layerId==='buildings')!.areas!;
 const roads = merged.semantics.find(s=>s.layerId==='roads')!.edges;
 expect(buildings.map(a=>a.id)).toEqual(['b1','b2','tall']);
 expect(roads.map(e=>e.id)).toEqual(['road:segment:1','road:segment:2','road:segment:3']);
 expect(buildings[2].properties?.sourceTileKey).toBe('new-york:1:0');
 expect(buildings[2].properties?.sourceCityId).toBe('east');
 expect(buildings[2].properties?.cityId).toBe('new-york');
 expect(merged.identity.buildingCount).toBe(3);
 expect(merged.identity.maxHeightM).toBe(100);
 expect(merged.identity.explicitHeightCoveragePercent).toBe(100);
 expect(merged.power.nodes).toHaveLength(1);
 expect(merged.power.edges).toHaveLength(0);
 expect(merged.illumination.nodes).toHaveLength(3);
 expect(initial.semantics[0].areas).toHaveLength(2);
});

test('streaming maintains base geometry, rejects fallback or stale tiles and evicts outside bounded LRU', () => {
 const initial=bundle('core',['b1'],[]);
 const tiles=Array.from({length:5},(_,index)=>({
  key:`new-york:${index+1}:0`,bundle:bundle(`tile${index+1}`,[`extra${index+1}`],[])
 }));
 const merged=mergeCitySpatialTiles(initial,tiles,{maxTiles:3});
 expect(merged.semantics.find(s=>s.layerId==='buildings')!.areas!.map(a=>a.id))
   .toEqual(['b1','extra3','extra4','extra5']);
 const bad=bundle('bad',['fake'],[]);
 bad.semantics[0].fallback=true;
 const safe=mergeCitySpatialTiles(initial,[{key:'fake',bundle:bad}]);
 expect(safe.identity.buildingCount).toBe(1);
});

test('tile merges preserve every power-line segment while deduplicating identical source edges', () => {
  const core=bundle('core',['b1'],[]);
  core.power.edges=[
    {id:'line:segment:1',kind:'transmission',from:{latitude:40,longitude:-74},to:{latitude:41,longitude:-74},properties:{sourceFeatureId:'line'}},
    {id:'line:segment:2',kind:'transmission',from:{latitude:41,longitude:-74},to:{latitude:42,longitude:-74},properties:{sourceFeatureId:'line'}}
  ];
  const nearby=bundle('nearby',['b2'],[]);
  nearby.power.edges=[
    {id:'line:segment:1',kind:'transmission',from:{latitude:40,longitude:-74},to:{latitude:41,longitude:-74},properties:{sourceFeatureId:'line'}},
    {id:'line:segment:3',kind:'transmission',from:{latitude:42,longitude:-74},to:{latitude:43,longitude:-74},properties:{sourceFeatureId:'line'}}
  ];
  expect(mergeCitySpatialTiles(core,[{key:'tile:1:0',bundle:nearby}]).power.edges.map(edge=>edge.id))
    .toEqual(['line:segment:1','line:segment:2','line:segment:3']);
});
