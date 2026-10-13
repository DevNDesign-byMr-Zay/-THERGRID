import {expect,test} from '@playwright/test';
import {RendererManager} from '../src/renderer/renderer-manager';

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
