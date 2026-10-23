import type {VisualMode} from '../renderer/spatial-renderer';

export const GRID_VIEWS = ['solid','wireframe','grid','xray','holographic','operations','reality'] as const satisfies readonly VisualMode[];
export const GRID_LAYERS = ['world','terrain','buildings','illumination','roads','water','green','grid','weather','weather-radar','air','aviation','seismic','hazards','transit','hydrology','energy','annotations','workset-analysis','scenario-model'] as const;
export const GRID_SKILLS = ['inspect_context','read_observations','set_view','set_layer','focus_location','set_time','compare_scenario'] as const;
export type GridAction =
  | {type:'set_view';view:typeof GRID_VIEWS[number]}
  | {type:'set_layer';layer:typeof GRID_LAYERS[number];enabled:boolean}
  | {type:'focus_location';latitude:number;longitude:number;label?:string}
  | {type:'set_time';mode:'live';at?:never}
  | {type:'set_time';mode:'historical'|'forecast';at:string};
const only=(row:Record<string,unknown>,keys:readonly string[])=>Object.keys(row).every(key=>keys.includes(key));
const finite=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
function instant(value:unknown):value is string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return false;
  const time=Date.parse(value);return Number.isFinite(time)&&new Date(time).toISOString().slice(0,19)===value.slice(0,19);
}
/** Atomic, fail-closed boundary. Unknown fields, oversized batches and invalid members reject all actions. */
export function validateGridActions(value:unknown):GridAction[]|null {
  if(!Array.isArray(value)||value.length>8)return null;
  const result:GridAction[]=[];
  for(const item of value){
    if(!item||typeof item!=='object'||Array.isArray(item))return null;
    const row=item as Record<string,unknown>;
    if(row.type==='set_view'&&only(row,['type','view'])&&GRID_VIEWS.includes(row.view as typeof GRID_VIEWS[number]))result.push({type:'set_view',view:row.view as typeof GRID_VIEWS[number]});
    else if(row.type==='set_layer'&&only(row,['type','layer','enabled'])&&GRID_LAYERS.includes(row.layer as typeof GRID_LAYERS[number])&&typeof row.enabled==='boolean')result.push({type:'set_layer',layer:row.layer as typeof GRID_LAYERS[number],enabled:row.enabled});
    else if(row.type==='focus_location'&&only(row,['type','latitude','longitude','label'])&&finite(row.latitude,-90,90)&&finite(row.longitude,-180,180)&&(row.label===undefined||(typeof row.label==='string'&&row.label.trim().length>0&&row.label.length<=120&&!/[\u0000-\u001f\u007f]/.test(row.label))))result.push({type:'focus_location',latitude:row.latitude as number,longitude:row.longitude as number,...(typeof row.label==='string'?{label:row.label}:{})});
    else if(row.type==='set_time'&&only(row,['type','mode','at'])&&row.mode==='live'&&!('at'in row))result.push({type:'set_time',mode:'live'});
    else if(row.type==='set_time'&&only(row,['type','mode','at'])&&(row.mode==='historical'||row.mode==='forecast')&&instant(row.at))result.push({type:'set_time',mode:row.mode,at:row.at});
    else return null;
  }
  return result;
}

export function gridActionDescription(action:GridAction):string {
  switch(action.type){
    case 'set_view':return `View → ${action.view}`;
    case 'set_layer':return `Layer ${action.layer} → ${action.enabled?'shown':'hidden'}`;
    case 'focus_location':return `Focus → ${action.label??'coordinate'} (${action.latitude}, ${action.longitude})`;
    case 'set_time':return `Time → ${action.mode}${action.at?` · ${action.at}`:''}`;
  }
}
