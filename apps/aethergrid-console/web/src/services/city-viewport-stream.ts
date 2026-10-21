import type {CameraCityTile,CameraTileCenter,CameraTilePosition,CameraTileStreamOptions,LoadedCityTile} from './city-tile-stream';
import {MAX_CITY_CACHE_TILES} from './city-tile-stream';
import type {CitySpatialBundle} from './city-power-overlay';

export const CITY_VIEW_STEP_M = 600;
export const MAX_CITY_VIEW_TILES = MAX_CITY_CACHE_TILES;
const MAX_BUILDINGS = 20_000;
const METERS = 111_320;
const wrap = (value:number) => ((value+540)%360+360)%360-180;
type Geo = {latitude:number;longitude:number};
export interface ViewCamera extends CameraTilePosition {focus?:Geo;footprint?:readonly Geo[]}
export interface ViewTile extends CameraCityTile {priority:'visible'|'prefetch';distanceM:number}
export interface CityViewPlan {level:'district'|'city'|'regional';tiles:ViewTile[];focusKey:string|null}
const valid = (point:Geo) => Number.isFinite(point.latitude) && Math.abs(point.latitude)<=80 && Number.isFinite(point.longitude) && Math.abs(point.longitude)<=180;
const empty = ():CityViewPlan => ({level:'regional',tiles:[],focusKey:null});

/** Small overlapping source requests, ranked in an unwrapped local projection.
 * The view footprint is an ellipsoid approximation, not surveyed terrain.
 */
export function planCityView({center,camera,previousFocus}:{center:CameraTileCenter;camera:ViewCamera;previousFocus?:Geo}):CityViewPlan {
  const focus=camera.focus??camera;
  if(!valid(center)||!valid(camera)||!valid(focus)||!Number.isFinite(camera.heightMeters)||camera.heightMeters<0||camera.heightMeters>6000)return empty();
  const eastScale=METERS*Math.cos(center.latitude*Math.PI/180);
  const project=(p:Geo)=>({x:wrap(p.longitude-center.longitude)*eastScale,y:(p.latitude-center.latitude)*METERS});
  const ground=project(focus);
  if(Math.hypot(ground.x,ground.y)>50_000)return empty();
  const ix=Math.round(ground.x/CITY_VIEW_STEP_M),iy=Math.round(ground.y/CITY_VIEW_STEP_M);
  const level=camera.heightMeters<=1800?'district':'city';
  const polygon=(camera.footprint??[]).filter(valid).map(project);
  const usePolygon=polygon.length===4 && polygon.every(p=>Math.hypot(p.x-ground.x,p.y-ground.y)<=12_000);
  const radius=Math.min(1600,Math.max(320,camera.heightMeters*.7));
  const intersects=(x:number,y:number)=>{
    if(!usePolygon)return Math.hypot(x-ground.x,y-ground.y)<=radius+450;
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[j],b=polygon[i],dx=b.x-a.x,dy=b.y-a.y;
      if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
      if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<=450)return true;
    }
    return inside;
  };
  const key=(x:number,y:number)=>`${center.id}:view:${x}:${y}`;
  const tile=(x:number,y:number,priority:ViewTile['priority']):ViewTile=>({
    key:key(x,y),latitude:center.latitude+y*CITY_VIEW_STEP_M/METERS,
    longitude:wrap(center.longitude+x*CITY_VIEW_STEP_M/eastScale),radiusM:450,priority,
    distanceM:Math.hypot(x*CITY_VIEW_STEP_M-ground.x,y*CITY_VIEW_STEP_M-ground.y)
  });
  const candidates:ViewTile[]=[];
  // Bound planning work even when the camera sees the distant horizon.
  for(let x=ix-4;x<=ix+4;x++)for(let y=iy-4;y<=iy+4;y++){
    if(x===0&&y===0)continue; // pinned core district already supplied by App
    if(Math.hypot(x*CITY_VIEW_STEP_M,y*CITY_VIEW_STEP_M)>50_000)continue;
    const item=tile(x,y,'visible');
    if(valid(item)&&intersects(x*CITY_VIEW_STEP_M,y*CITY_VIEW_STEP_M))candidates.push(item);
  }
  candidates.sort((a,b)=>a.distanceM-b.distanceM||a.key.localeCompare(b.key));
  const tiles=candidates.slice(0,level==='district'?9:4);
  if(previousFocus&&valid(previousFocus)){
    const previous=project(previousFocus),dx=ground.x-previous.x,dy=ground.y-previous.y;
    if(Math.hypot(dx,dy)>=50){
      const axis=Math.abs(dx)>=Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)];
      const x=ix+axis[0],y=iy+axis[1],next=tile(x,y,'prefetch');
      if((x!==0||y!==0)&&valid(next)&&Math.hypot(x*CITY_VIEW_STEP_M,y*CITY_VIEW_STEP_M)<=50_000&&!tiles.some(t=>t.key===next.key))tiles.push(next);
    }
  }
  return {level,tiles,focusKey:key(ix,iy)};
}

const admissible=(bundle:CitySpatialBundle)=>[bundle.power,bundle.illumination,...bundle.semantics].every(s=>s.live&&!s.stale&&!s.fallback);
const buildingCount=(bundle:CitySpatialBundle)=>bundle.semantics.find(s=>s.layerId==='buildings')?.areas?.length??0;
const bounded=(value:number|undefined,fallback:number,maximum:number)=>Number.isFinite(value)?Math.max(1,Math.min(maximum,Math.floor(value!))):fallback;

/** One request at a time. Visible cells precede one travel-direction prefetch.
 * A small LRU remains reusable while only nearby cells are published to scene.
 */
export class ViewportCityStream {
  readonly #options:CameraTileStreamOptions;
  readonly #limit:number;
  readonly #buildingLimit:number;
  readonly #cache=new Map<string,{tile:ViewTile;bundle:CitySpatialBundle}>();
  readonly #failedUntil=new Map<string,number>();
  readonly #budgetBlocked=new Set<string>();
  #pending:{key:string;abort:AbortController}|null=null;
  #candidate:string|null=null;
  #dwell=0;
  #disposed=false;
  #focus:Geo|undefined;
  #travelFrom:Geo|undefined;
  #plan:CityViewPlan=empty();
  #publication='';
  #budgetView='';
  constructor(options:CameraTileStreamOptions&{maxBuildings?:number}){
    this.#options=options;
    this.#limit=bounded(options.maxTiles,MAX_CITY_VIEW_TILES,MAX_CITY_VIEW_TILES);
    this.#buildingLimit=bounded(options.maxBuildings,MAX_BUILDINGS,MAX_BUILDINGS);
  }
  get tiles():readonly LoadedCityTile[]{return [...this.#cache].map(([key,{bundle}])=>({key,bundle}));}
  get buildingCount():number{return [...this.#cache.values()].reduce((n,item)=>n+buildingCount(item.bundle),0);}
  async sample(camera:ViewCamera):Promise<void>{
    if(this.#disposed)return;
    const focus=camera.focus??camera;
    if(!this.#focus||focus.latitude!==this.#focus.latitude||focus.longitude!==this.#focus.longitude){this.#travelFrom=this.#focus;this.#focus={latitude:focus.latitude,longitude:focus.longitude};}
    const plan=planCityView({center:this.#options.center,camera,previousFocus:this.#travelFrom});
    this.#plan=plan;
    const budgetView=plan.tiles.map(t=>t.key).join('|');
    if(budgetView!==this.#budgetView){this.#budgetView=budgetView;this.#budgetBlocked.clear();}
    if(this.#pending&&!plan.tiles.some(t=>t.key===this.#pending!.key))this.#pending.abort.abort();
    if(!plan.tiles.length){this.#candidate=null;this.#dwell=0;this.#publish();return;}
    if(this.#candidate!==plan.focusKey){this.#candidate=plan.focusKey;this.#dwell=1;this.#budgetBlocked.clear();return;}
    this.#dwell++;
    this.#publish();
    if(this.#dwell<2||this.#pending)return;
    // Touch the nearest visible cached cell, without making prefetch most recent.
    const nearest=plan.tiles[0],cached=this.#cache.get(nearest.key);
    if(cached){this.#cache.delete(nearest.key);this.#cache.set(nearest.key,cached);}
    const now=(this.#options.now??Date.now)();
    const next=plan.tiles.find(t=>!this.#cache.has(t.key)&&!this.#budgetBlocked.has(t.key)&&(this.#failedUntil.get(t.key)??0)<=now);
    if(!next)return;
    const abort=new AbortController();this.#pending={key:next.key,abort};
    try {
      const bundle=await this.#options.load(next,abort.signal);
      if(this.#disposed||abort.signal.aborted)return;
      if(!admissible(bundle))throw new Error('Mapped city tile unavailable; fallback withheld');
      if(buildingCount(bundle)>this.#buildingLimit)throw new Error('Mapped tile exceeds the scene building budget; source geometry withheld');
      this.#cache.set(next.key,{tile:next,bundle});
      this.#failedUntil.delete(next.key);
      // Evict offscreen/lowest-priority data before the nearest visible cell.
      while(this.#cache.size>this.#limit||this.buildingCount>this.#buildingLimit){
        const rank=(key:string)=>{const i=this.#plan.tiles.findIndex(t=>t.key===key);return i<0?Infinity:i;};
        const victim=[...this.#cache.keys()].reduce((worst,key)=>rank(key)>rank(worst)?key:worst);
        this.#cache.delete(victim);
        if(victim===next.key)this.#budgetBlocked.add(next.key);
      }
      this.#publish();
    }catch(error){
      if(this.#disposed||abort.signal.aborted)return;
      this.#failedUntil.delete(next.key);this.#failedUntil.set(next.key,(this.#options.now??Date.now)()+30_000);
      if(this.#failedUntil.size>64)this.#failedUntil.delete(this.#failedUntil.keys().next().value!);
      this.#options.onError?.(error instanceof Error?error.message:String(error));
    }finally{if(this.#pending?.abort===abort)this.#pending=null;}
  }
  #publish():void{
    const wanted=new Set(this.#plan.tiles.map(t=>t.key));
    const visible=this.tiles.filter(t=>wanted.has(t.key));
    const signature=visible.map(t=>t.key).sort().join('|');
    if(signature===this.#publication)return;
    this.#publication=signature;this.#options.onChange(visible);
  }
  dispose():void{this.#disposed=true;this.#pending?.abort.abort();this.#pending=null;this.#cache.clear();this.#failedUntil.clear();this.#budgetBlocked.clear();}
}
