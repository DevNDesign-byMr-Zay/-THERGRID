import { expect, test } from '@playwright/test';
import { runAgent } from '../src/services/agent-client';

test('incomplete specialist contributions retain unknown provenance without crashing', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => ({ok:true,json:async()=>({reply:'TEAM response',contributions:[null,{}, {agent:'AUREN',reply:'Partial response',receipt:'actual-receipt'}],evidence:{id:'actual-evidence',title:{malformed:true}}})})) as any;
  try {
    const result=await runAgent('TEAM','inspect',{region:'NEW YORK',view:'solid',temporalMode:'live',temporalCursor:'2026-10-13T00:00:00Z',coordinate:{latitude:40,longitude:-74}},[]);
    expect(result.contributions).toHaveLength(1);
    expect(result.contributions![0].runtime.provider).toBe('unknown');
    expect(result.contributions![0].runtime.model).toBeNull();
    expect(result.evidence).toEqual({id:'actual-evidence'});
  } finally {globalThis.fetch=original;}
});

test('late specialist response after an aborted handoff cannot be accepted', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = (async () => ({ ok: true, json: async () => {
    controller.abort(); return { reply: 'late response', runtime: { provider: 'contract-model' } };
  } })) as any;
  try { await expect(runAgent('AUREN','inspect',{ region:'NEW YORK', view:'solid', temporalMode:'live', temporalCursor:'2026-10-13T00:00:00Z', coordinate:{latitude:40,longitude:-74} },[],controller.signal)).rejects.toThrow(/abort/i); }
  finally { globalThis.fetch = original; }
});

test('specialist request records retain copied source context and bound their history', async () => {
  const module = await import('../src/services/agent-run-history').catch(() => null);
  expect(module).not.toBeNull();
  const context: any = { region:'NEW YORK', view:'solid', temporalMode:'forecast', temporalCursor:'2026-10-13T00:00:00Z', coordinate:{ latitude:40,longitude:-74 }, selectedEntity:{id:'building-4',sourceFeatureId:'osm:4',token:'SECRET'}, token:'SECRET' };
  const response: any = { reply:'Source-backed analysis', receipt:'server-receipt', runtime:{provider:'unknown',model:null,fallbackUsed:false}, advisoryOnly:true };
  const record = module!.createAgentRunRecord('AUREN','inspect',context,response,'2026-10-13T00:00:00Z','2026-10-13T00:00:01Z');
  context.coordinate.latitude=0; context.selectedEntity.id='replaced';
  expect(record.context.coordinate.latitude).toBe(40);
  expect(record.context.selectedEntityId).toBe('building-4');
  expect(JSON.stringify(record)).not.toContain('SECRET');
  let runs: any[]=[];
  for(let n=0;n<20;n++) runs=module!.appendAgentRun(runs,{...record,id:String(n)});
  expect(runs).toHaveLength(8); expect(runs[0].id).toBe('12');
  expect(module!.agentResponseState(response)).toBe('UNVERIFIED RESPONSE');
  expect(module!.agentResponseState({...response,runtime:{...response.runtime,provider:'provider-a',model:'model-a'}})).toBe('PROVIDER RESPONSE');
  expect(module!.agentResponseState({...response,runtime:{...response.runtime,fallbackUsed:true}})).toBe('LOCAL FALLBACK');
});
