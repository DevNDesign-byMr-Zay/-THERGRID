import {expect,test} from '@playwright/test';
import {RendererManager} from '../src/renderer/renderer-manager';
import {CameraJourneyController} from '../src/renderer/cesium/camera-journey-controller';

test('modal rendering activity survives delayed initialization and renderer replacement',async()=>{
  let release!:()=>void;
  const events:string[]=[];
  const adapter=(engine:string,delayed=false):any=>new Proxy({
    engine,
    initialize:async()=>{if(delayed)await new Promise<void>(resolve=>release=resolve);},
    setRenderingActive:(active:boolean)=>events.push(`${engine}:${active}`),
    status:()=>({engine,ready:true,visualMode:'solid'})
  },{get:(object,key)=>key in object?(object as any)[key]:()=>{}});
  const manager=new RendererManager(adapter('cesium',true),adapter('native-webgl',true));
  manager.mount({} as any);
  const initializing=manager.initialize();
  manager.setRenderingActive(false);
  release();await initializing;
  expect(events.at(-1)).toBe('cesium:false');
  const switching=manager.use('native-webgl');
  manager.setRenderingActive(true);
  release();await switching;
  expect(events.at(-1)).toBe('native-webgl:true');
  manager.setRenderingActive(false);
  expect(events.at(-1)).toBe('native-webgl:false');
  manager.destroy();
});

test('a modal completes an in-flight camera journey without waiting for paused render ticks',async()=>{
  let complete:(()=>void)|undefined;
  const durations:number[]=[];
  const ranges:number[]=[];
  const camera:any={
    cancelFlight:()=>complete?.(),
    completeFlight:()=>complete?.(),
    flyToBoundingSphere:(_sphere:any,options:any)=>{
      durations.push(options.duration);ranges.push(options.offset.range);
      complete=options.complete;
      if(options.duration===0)options.complete();
    }
  };
  const controller=new CameraJourneyController(camera);
  const pending=controller.flyTo({latitude:40.75,longitude:-73.98,rangeMeters:4321});
  expect(durations[0]).toBeGreaterThan(0);
  controller.setRenderingActive(false);
  await pending;
  expect(durations.slice(1)).toEqual([0,0,0]);
  expect(ranges.at(-1)).toBe(4321);
  await controller.flyTo({latitude:51,longitude:0,rangeMeters:1234,journey:'direct'});
  expect(durations.at(-1)).toBe(0);
  controller.setRenderingActive(true);
  const resumed=controller.flyTo({latitude:35,longitude:139,journey:'direct'});
  expect(durations.at(-1)).toBeGreaterThan(0);
  complete?.();await resumed;
});

test('frame and source updates during renderer activation never reach a destroyed adapter',async()=>{
  let release!:()=>void;
  const events:string[]=[];
  function adapter(engine:string,delayed=false):any{
    let destroyed=false;
    return new Proxy({engine,initialize:async()=>{if(delayed)await new Promise<void>(resolve=>release=resolve);destroyed=false;},destroy:()=>{destroyed=true;},status:()=>({engine,ready:!destroyed,visualMode:'solid'}),flyTo:async(target:any)=>events.push(`${engine}:target:${target.latitude}`),setTime:(time:any)=>{if(destroyed)throw Error('destroyed adapter');events.push(`${engine}:${time.iso}`);},applyOverlay:(value:any)=>{if(destroyed)throw Error('destroyed adapter');events.push(`${engine}:${value.id}`);}}, {get:(target,key)=>key in target?(target as any)[key]:()=>{}});
  }
  const manager=new RendererManager(adapter('cesium'),adapter('native-webgl',true));manager.mount({} as any);await manager.initialize();
  const switching=manager.use('native-webgl');
  expect(()=>manager.setTime({mode:'live',iso:'2026-10-13T12:01:00Z'})).not.toThrow();
  expect(()=>manager.applyOverlay({id:'latest-source',layerId:'buildings',nodes:[],edges:[]} as any)).not.toThrow();
  expect(manager.status().ready).toBe(false);
  await manager.flyTo({latitude:51,longitude:0});
  release();await switching;
  expect(events).toEqual(['native-webgl:latest-source','native-webgl:2026-10-13T12:01:00Z','native-webgl:target:51']);
  expect(manager.status().ready).toBe(true);
});

test('disposing a renderer manager during activation cannot resurrect it or trigger fallback',async()=>{
 let release!:()=>void;
 const events:string[]=[];
 const adapter=(engine:string,delayed=false):any=>new Proxy({engine,mount:()=>events.push(`${engine}:mount`),initialize:async()=>{if(delayed)await new Promise<void>(resolve=>release=resolve);events.push(`${engine}:initialized`);},destroy:()=>events.push(`${engine}:destroy`),status:()=>({engine,ready:true,visualMode:'solid'})},{get:(object,key)=>key in object?(object as any)[key]:()=>{}});
 const manager=new RendererManager(adapter('cesium',true),adapter('native-webgl'));manager.mount({} as any);
 const pending=manager.initialize();manager.destroy();release();
 await expect(pending).rejects.toThrow(/disposed/);
 expect(events).not.toContain('native-webgl:mount');
 expect(events.at(-1)).toBe('cesium:destroy');
 await expect(manager.initialize()).rejects.toThrow(/disposed/);
});
