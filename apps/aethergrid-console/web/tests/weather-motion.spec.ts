import {expect,test} from '@playwright/test';
import {Cartesian3,PrimitiveCollection,DataSourceCollection} from 'cesium';
import {WeatherAtmosphereLayer} from '../src/renderer/cesium/weather-atmosphere-layer';
import {NativeWebglSpatialRenderer} from '../src/renderer/native/native-webgl-renderer';
import {NetworkOverlayLayer} from '../src/renderer/cesium/network-overlay-layer';

test('Cesium reduced-motion night presentation does not pulse when the frame advances',async()=>{
  const globals=globalThis as any,old=globals.window;
  globals.window={matchMedia:()=>({matches:true})};
  const dataSources=new DataSourceCollection(),primitives=new PrimitiveCollection();
  const layer=new NetworkOverlayLayer({dataSources,scene:{primitives,requestRender(){}}} as any);
  await Promise.resolve();
  try{
    layer.apply({id:'night-contract',layerId:'illumination',eventTime:'2026-10-13T04:00:00Z',nodes:[{id:'night-point',kind:'asset',position:{latitude:40,longitude:-74,heightMeters:110},intensity:.5,properties:{presentationType:'urban-illumination'}}],edges:[],areas:[]} as any);
    const point=dataSources.get(0).entities.getById('night-point')!.point!;
    layer.setTime({mode:'live',iso:'2026-10-13T04:00:00Z'});
    const size=point.pixelSize!.getValue(),color=point.color!.getValue();
    layer.setTime({mode:'live',iso:'2026-10-13T04:01:00Z'});
    expect(point.pixelSize!.getValue()).toBe(size);expect(point.color!.getValue()).toEqual(color);
  }finally{layer.destroy();dataSources.destroy();primitives.destroy();if(old===undefined)delete globals.window;else globals.window=old;}
});

test('native reduced-motion weather geometry remains fixed while source time advances',async()=>{
  const globals=globalThis as any, oldDocument=globals.document,oldWindow=globals.window;
  let geometry:number[][]=[];
  const context:any=new Proxy({moveTo:(...v:number[])=>geometry.push(v),lineTo:(...v:number[])=>geometry.push(v),arc:(...v:number[])=>geometry.push(v)}, {get:(target,key)=>key in target?target[key]:()=>{}});
  const canvas:any={style:{},clientWidth:800,clientHeight:600,width:800,height:600,setAttribute(){},remove(){},getContext:(kind:string)=>kind==='2d'?context:null};
  globals.document={createElement:()=>canvas};globals.window={matchMedia:()=>({matches:true})};
  const renderer=new NativeWebglSpatialRenderer();
  try{
    renderer.mount({clientWidth:800,clientHeight:600,replaceChildren(){}} as any);await renderer.initialize();
    renderer.applyAtmosphere({coordinate:{latitude:40,longitude:-74},current:{weatherCode:61,precipitationMm:2,cloudCoverPercent:60,windSpeedKph:15}} as any);
    geometry=[];renderer.setTime({mode:'live',iso:'2026-10-13T12:00:00Z'});const first=geometry;
    geometry=[];renderer.setTime({mode:'live',iso:'2026-10-13T12:01:00Z'});expect(geometry).toEqual(first);
  }finally{renderer.destroy();if(oldDocument===undefined)delete globals.document;else globals.document=oldDocument;if(oldWindow===undefined)delete globals.window;else globals.window=oldWindow;}
});

test('reduced motion removes precipitation, freezes cloud drift and reacts to preference changes',()=>{
  const globals=globalThis as any, old=globals.window;
  const listeners=new Set<()=>void>();
  const media={matches:true,addEventListener:(_name:string,callback:()=>void)=>listeners.add(callback),removeEventListener:(_name:string,callback:()=>void)=>listeners.delete(callback)};
  globals.window={matchMedia:()=>media};
  const primitives=new PrimitiveCollection();
  const layer=new WeatherAtmosphereLayer({scene:{primitives,fog:{enabled:true,density:.0002,visualDensityScalar:1,minimumBrightness:.1},requestRender(){}}} as any);
  try{
    layer.apply({coordinate:{latitude:40,longitude:-74},live:true,fallback:false,current:{weatherCode:61,precipitationMm:2,cloudCoverPercent:60,windSpeedKph:15,windDirectionDegrees:90}} as any);
    expect(primitives.length).toBe(1);
    const before=Cartesian3.clone(primitives.get(0).noiseOffset);
    layer.setTime({mode:'live',iso:'2026-10-13T12:00:00Z'});
    expect(primitives.get(0).noiseOffset).toEqual(before);
    media.matches=false;listeners.forEach(callback=>callback());
    expect(primitives.length).toBe(2);
    layer.setTime({mode:'live',iso:'2026-10-13T13:00:00Z'});
    expect(primitives.get(0).noiseOffset).not.toEqual(before);
    media.matches=true;listeners.forEach(callback=>callback());
    expect(primitives.length).toBe(1);
  }finally{layer.destroy();primitives.destroy();if(old===undefined)delete globals.window;else globals.window=old;}
  expect(listeners.size).toBe(0);
});
