import {expect,test} from '@playwright/test';
import {planCityView,ViewportCityStream,CITY_VIEW_STEP_M} from '../src/services/city-viewport-stream';
import type {CitySpatialBundle} from '../src/services/city-power-overlay';
const center={id:'new-york',latitude:40,longitude:-74};
const position=(east:number,north=0,heightMeters=600)=>({latitude:40+north/111320,longitude:-74+east/(111320*Math.cos(40*Math.PI/180)),heightMeters});
const footprint=(east:number)=>[position(east-100,-80),position(east+100,-80),position(east+100,80),position(east-100,80)];
const live=(id:string,count=1):CitySpatialBundle=>{
 const layer=(layerId:string)=>({id,layerId,eventTime:'2026-10-21T00:00:00Z',live:true,stale:false,fallback:false,nodes:[],edges:[],areas:layerId==='buildings'?Array.from({length:count},(_,i)=>({id:`${id}:${i}`,kind:'building',positions:[]})):[]});
 return {power:layer('energy'),illumination:layer('illumination'),semantics:[layer('buildings')],identity:{cityId:center.id}} as any;
};
test('adaptive coverage follows ground focus beyond old district boundary with overlapping fixed-size requests',()=>{
 const plan=planCityView({center,camera:{...position(500),focus:position(9000)}});
 expect(plan.tiles.length).toBeGreaterThan(0);expect(plan.tiles[0].key).toContain(':15:0');
 expect(plan.tiles.every(t=>t.radiusM===450)).toBe(true);expect(CITY_VIEW_STEP_M/Math.sqrt(2)).toBeLessThan(450);
 expect(plan.tiles.length).toBeLessThanOrEqual(10);expect(plan.level).toBe('district');
});
test('footprint culling prioritizes visible cells and puts travel prefetch after them',()=>{
 const focus=position(6000),plan=planCityView({center,camera:{...focus,focus,footprint:footprint(6000)},previousFocus:position(5400)});
 expect(plan.tiles[0].priority).toBe('visible');expect(plan.tiles[0].key).toContain(':10:0');
 expect(plan.tiles.find(t=>t.priority==='prefetch')?.key).toContain(':11:0');
 expect(plan.tiles.at(-1)?.priority).toBe('prefetch');expect(plan.tiles.filter(t=>t.priority==='visible')).toHaveLength(1);
});
test('adaptive city LOD stops at regional altitude and rejects invalid or unbounded geography',()=>{
 expect(planCityView({center,camera:position(6000,0,3000)}).level).toBe('city');
 expect(planCityView({center,camera:position(6000,0,9000)}).tiles).toEqual([]);
 for(const camera of [position(51000),position(0,0,-1),{...position(0),latitude:NaN}])expect(planCityView({center,camera}).tiles).toEqual([]);
 expect(planCityView({center:{...center,latitude:89},camera:position(0)}).tiles).toEqual([]);
});
test('adaptive dateline plans remain neighboring and produce finite normalized coordinates',()=>{
 const plan=planCityView({center:{id:'dateline',latitude:10,longitude:179.998},camera:{latitude:10,longitude:-179.945,heightMeters:500}});
 expect(plan.tiles.length).toBeGreaterThan(0);expect(plan.tiles.every(t=>Number.isFinite(t.latitude)&&t.longitude>=-180&&t.longitude<=180)).toBe(true);
 expect(plan.tiles[0].key).toContain(':10:0');
});
test('viewport scheduler waits for dwell, serializes, and reuses cached visible data',async()=>{
 const calls:string[]=[],stream=new ViewportCityStream({center,load:async tile=>{calls.push(tile.key);return live(tile.key);},onChange:()=>{}});
 const camera={...position(6000),footprint:footprint(6000)};
 await stream.sample(camera);expect(calls).toEqual([]);await stream.sample(camera);expect(calls).toHaveLength(1);
 await stream.sample(camera);expect(calls).toHaveLength(1);expect(stream.tiles).toHaveLength(1);stream.dispose();
});
test('regional altitude aborts obsolete work; disposal never publishes late results',async()=>{
 let aborted=0,changed=0;
 const stream=new ViewportCityStream({center,load:async(_tile,signal)=>new Promise((_resolve,reject)=>{
 signal.addEventListener('abort',()=>{aborted++;reject(new DOMException('aborted','AbortError'));},{once:true});}),onChange:()=>{changed++;}});
 await stream.sample(position(6000));const pending=stream.sample(position(6000));await stream.sample(position(6000,0,9000));await pending;
 expect(aborted).toBe(1);stream.dispose();expect(changed).toBe(0);await stream.sample(position(6000));expect(aborted).toBe(1);
});
test('viewport cache obeys tile and feature budgets across long camera travel',async()=>{
 const stream=new ViewportCityStream({center,maxTiles:3,maxBuildings:5,load:async tile=>live(tile.key,2),onChange:()=>{}});
 for(const east of [6000,9000,12000,15000,18000]){await stream.sample(position(east));await stream.sample(position(east));expect(stream.tiles.length).toBeLessThanOrEqual(2);expect(stream.buildingCount).toBeLessThanOrEqual(5);}
 expect(stream.tiles.at(-1)?.key).toContain(':30:0');stream.dispose();expect(stream.tiles).toEqual([]);
});
test('failed or fallback tiles back off, recover with original evidence, and never publish invented data',async()=>{
 let now=0,requests=0,errors=0;const emitted:string[]=[];
 const stream=new ViewportCityStream({center,now:()=>now,load:async tile=>{requests++;const bundle=live(tile.key);if(requests===1)bundle.semantics[0].fallback=true;return bundle;},onChange:tiles=>emitted.push(...tiles.map(t=>t.key)),onError:()=>{errors++;}});
 const camera={...position(6000),footprint:footprint(6000)};
 await stream.sample(camera);await stream.sample(camera);await stream.sample(camera);expect(requests).toBe(1);expect(errors).toBe(1);expect(emitted).toEqual([]);
 now=30001;await stream.sample(camera);expect(requests).toBe(2);expect(emitted).toHaveLength(1);expect(stream.tiles[0].bundle.semantics[0].fallback).toBe(false);stream.dispose();
});

test('stationary constrained views keep the nearest geometry and stop reloading evicted cells',async()=>{
 let requests=0;
 const stream=new ViewportCityStream({center,maxTiles:2,maxBuildings:3,load:async tile=>{requests++;return live(tile.key,2);},onChange:()=>{}});
 for(let i=0;i<25;i++)await stream.sample(position(6000));
 expect(stream.tiles.some(t=>t.key.endsWith(':10:0'))).toBe(true);
 expect(requests).toBeLessThanOrEqual(9);
 stream.dispose();
});

test('leaving streaming altitude clears the published view while retaining a reusable bounded cache',async()=>{
 const publications:string[][]=[];
 const stream=new ViewportCityStream({center,load:async tile=>live(tile.key),onChange:tiles=>publications.push(tiles.map(t=>t.key))});
 const camera={...position(6000),footprint:footprint(6000)};
 await stream.sample(camera);await stream.sample(camera);
 expect(publications.at(-1)?.length).toBe(1);
 await stream.sample(position(6000,0,9000));expect(publications.at(-1)).toEqual([]);
 expect(stream.tiles).toHaveLength(1);
 await stream.sample(camera);await stream.sample(camera);expect(publications.at(-1)?.length).toBe(1);
 stream.dispose();
});
test('slow failures back off from failure time rather than request start',async()=>{
 let now=0,requests=0;
 const stream=new ViewportCityStream({center,now:()=>now,load:async()=>{requests++;now+=60000;throw new Error('delayed provider outage');},onChange:()=>{}});
 const camera={...position(6000),footprint:footprint(6000)};
 await stream.sample(camera);await stream.sample(camera);await stream.sample(camera);expect(requests).toBe(1);
 now+=30001;await stream.sample(camera);expect(requests).toBe(2);stream.dispose();
});
test('changed viewport releases obsolete budget blocks without changing the focus cell',async()=>{
 const stream=new ViewportCityStream({center,maxTiles:2,maxBuildings:4,load:async tile=>live(tile.key,2),onChange:()=>{}});
 const camera={...position(6000),footprint:[position(5300,-80),position(6700,-80),position(6700,80),position(5300,80)]};
 for(let i=0;i<10;i++)await stream.sample(camera);
 const missing=planCityView({center,camera}).tiles.find(t=>!stream.tiles.some(c=>c.key===t.key))!;
 const east=missing.longitude<center.longitude+6000/(111320*Math.cos(40*Math.PI/180))?-1:1;
 const other={...position(6000),footprint:[position(6000,-80),position(6000+east*700,-80),position(6000+east*700,80),position(6000,80)]};
 for(let i=0;i<4;i++)await stream.sample(other);
 expect(stream.tiles.some(t=>t.key===missing.key)).toBe(true);stream.dispose();
});
