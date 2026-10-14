import { mkdir, readFile, writeFile, readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createObservationStore({dataDir,now=Date.now}) {
 const root=join(dataDir,'observations-v1');
 async function record({kind,coordinate,observedAt=new Date(now()).toISOString(),payload}) {
  if(!/^[a-z-]{1,40}$/.test(kind) || !Number.isFinite(Date.parse(observedAt)) || !Number.isFinite(coordinate?.lat) || !Number.isFinite(coordinate?.lon) || Math.abs(coordinate.lat)>90 || Math.abs(coordinate.lon)>180) throw new Error('invalid_observation');
  const content={version:1,kind,coordinate,observedAt,payload};
  if(JSON.stringify(content).length>2_000_000) throw new Error('observation_too_large');
  const receipt=hash(content); const value={...content,receipt};
  await mkdir(root,{recursive:true,mode:0o700});
  const names=await readdir(root);
  if(names.length >= 10000 && !names.includes(`${receipt}.json`)) throw new Error('observation_storage_capacity');
  const temporary=join(root,`.${receipt}-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`);
  try{await writeFile(temporary,JSON.stringify(value),{flag:'wx',mode:0o600});await rename(temporary,join(root,`${receipt}.json`));}finally{await unlink(temporary).catch(()=>{});}
  return value;
 }
 async function list({kind,lat,lon,at=new Date(now()).toISOString(),maxAgeMs=6*60*60*1000}={}) {
  const cursor=Date.parse(at); if(!Number.isFinite(cursor)) throw Object.assign(new Error('invalid_history_cursor'),{status:400});
  const names=await readdir(root).catch(error=>{if(error.code==='ENOENT') return [];throw error;});
  const results=[];
  for(const name of names) {
   if(!/^[a-f0-9]{64}\.json$/.test(name)) continue;
   const value=JSON.parse(await readFile(join(root,name),'utf8'));
   const {receipt,...content}=value;
   if(hash(content)!==receipt) throw new Error('observation_integrity_failure');
   const age=cursor-Date.parse(value.observedAt);
   if((!kind || value.kind===kind) && (lat===undefined || Math.abs(value.coordinate.lat-Number(lat))<0.00001) && (lon===undefined || Math.abs(value.coordinate.lon-Number(lon))<0.00001) && age>=0 && age<=maxAgeMs) results.push(value);
  }
  return results.sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)).slice(0,500);
 }
 async function replay(query) { return (await list(query))[0] || null; }
 return {record,list,replay};
}
