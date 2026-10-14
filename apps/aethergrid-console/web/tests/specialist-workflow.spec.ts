import {expect,test} from '@playwright/test';

test('backend model configuration preserves unavailable and malformed specialist metadata', async()=>{
  const module=await import('../src/services/agent-model-status').catch(()=>null);
  expect(module).not.toBeNull();
  const rows=module!.agentModelStatus({ai:{agents:{TEAM:{provider:'openai-compatible',model:'team-model',status:'configured'},AUREN:{provider:{secret:'invalid'},model:[],status:null}}}});
  expect(rows.find(row=>row.agent==='TEAM')).toEqual({agent:'TEAM',provider:'openai-compatible',model:'team-model',status:'configured'});
  expect(rows.find(row=>row.agent==='AUREN')).toEqual({agent:'AUREN',provider:null,model:null,status:'unavailable'});
  expect(module!.agentModelStatus(null)).toHaveLength(4);
  expect(JSON.stringify(rows)).not.toContain('secret');
});

test('failed and stopped requests retain context without fabricating execution receipts', async()=>{
  const module=await import('../src/services/agent-run-history');
  expect(typeof (module as any).createAgentUnfinishedRecord).toBe('function');
  const context:any={region:'NEW YORK',view:'solid',temporalMode:'historical',temporalCursor:'2026-10-13T12:00:00Z',coordinate:{latitude:40,longitude:-74},selectedEntity:{id:'building-a',sourceFeatureId:'osm:a',token:'SECRET'}};
  for(const status of ['failed','stopped']){
    const record=(module as any).createAgentUnfinishedRecord('AUREN','Inspect this building',context,status,'Request unavailable','2026-10-13T12:00:00Z','2026-10-13T12:00:01Z');
    expect(record.status).toBe(status);expect(record.response).toBeNull();expect(record.error).toBe('Request unavailable');
    expect(record.context.selectedEntityId).toBe('building-a');expect(record.context.sourceFeatureId).toBe('osm:a');
    expect(JSON.stringify(record)).not.toContain('SECRET');
  }
});
