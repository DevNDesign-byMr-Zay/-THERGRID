import {expect,test} from '@playwright/test';

const context={region:'Global',view:'solid',temporalMode:'live',temporalCursor:'2026-10-23T00:00:00Z',coordinate:{latitude:20,longitude:0}};
test('grid actions allow only bounded visualization changes and reject the entire malformed batch',async()=>{
  const module=await import('../src/services/agent-grid-actions').catch(()=>null);
  expect(module,'grid action boundary exists').not.toBeNull();
  const valid=[{type:'set_view',view:'wireframe'},{type:'set_layer',layer:'weather-radar',enabled:false},{type:'focus_location',latitude:51.5,longitude:-.1,label:'London'},{type:'set_time',mode:'historical',at:'2026-10-22T12:00:00Z'}];
  expect(module!.validateGridActions(valid)).toEqual(valid);
  for(const invalid of [null,{},[{type:'set_view',view:'execute'}],[{type:'set_layer',layer:'keys',enabled:true}],[{type:'set_layer',layer:'roads',enabled:'false'}],[{type:'focus_location',latitude:Infinity,longitude:0}],[{type:'focus_location',latitude:91,longitude:0}],[{type:'set_time',mode:'scenario',at:'2026-10-22T12:00:00Z'}],[{type:'set_time',mode:'forecast'}],[{type:'set_time',mode:'live',at:'2026-10-22T12:00:00Z'}],[{type:'set_time',mode:'historical',at:'2026-02-30T00:00:00Z'}],[{type:'set_view',view:'solid',script:'evil'}],Array(9).fill(valid[0]),[valid[0],{type:'unknown'}]])expect(module!.validateGridActions(invalid)).toBeNull();
});

test('only successful provider execution can supply actions; invalid batches fail closed',async()=>{
  const {runAgent}=await import('../src/services/agent-client');
  const original=globalThis.fetch;
  try{
    for(const runtime of [{provider:'groq',model:'openai/gpt-oss-20b',fallbackUsed:false,executionStatus:'succeeded'},{provider:'local',model:'local-team',fallbackUsed:false},{provider:'groq',model:'m',fallbackUsed:true},{provider:'groq',model:'m',executionStatus:'partial-failure'},{provider:'groq',model:'m',executionStatus:'failed'}]){
      globalThis.fetch=(async()=>({ok:true,json:async()=>({reply:'Done',receipt:'a'.repeat(64),runtime,actions:[{type:'set_view',view:'wireframe'}]})})) as any;
      const result=await runAgent('TEAM','inspect',context,[]);
      expect(result.actions).toEqual(runtime.executionStatus==='succeeded'?[{type:'set_view',view:'wireframe'}]:[]);
    }
    globalThis.fetch=(async()=>({ok:true,json:async()=>({reply:'Done',receipt:'a'.repeat(64),runtime:{provider:'groq',model:'m',executionStatus:'succeeded'},actions:[{type:'set_view',view:'solid'},{type:'set_layer',layer:'credentials',enabled:true}]})})) as any;
    expect((await runAgent('TEAM','inspect',context,[])).actions).toEqual([]);
  }finally{globalThis.fetch=original;}
});

test('model evidence allowlists skills and last execution metadata without exposing arbitrary values',async()=>{
  const {agentModelStatus}=await import('../src/services/agent-model-status');
  const rows=agentModelStatus({ai:{agents:{AUREN:{provider:'groq',model:'m',status:'configured',skills:['set_view','read_observations','secret'],lastSuccessfulExecution:{receipt:'receipt-success',executionStatus:'succeeded',provider:'groq',model:'m'},lastExecution:{receipt:'receipt-a',executionStatus:'succeeded',completedAt:'2026-10-23T00:00:00Z',provider:'groq',model:'m',fallbackUsed:false,token:'SECRET'}}}}});
  expect(rows.find(row=>row.agent==='AUREN')).toMatchObject({status:'configured',skills:['set_view','read_observations'],lastSuccessfulExecution:{receipt:'receipt-success',executionStatus:'succeeded',provider:'groq',model:'m'},lastExecution:{receipt:'receipt-a',executionStatus:'succeeded'}});
  expect(JSON.stringify(rows)).not.toContain('SECRET');
});

test('current execution state preserves partial failures and sanitized provider cooldown metadata',async()=>{
  const {agentModelStatus}=await import('../src/services/agent-model-status');
  const {agentResponseState}=await import('../src/services/agent-run-history');
  expect(agentResponseState({runtime:{provider:'groq',model:'m',fallbackUsed:false,executionStatus:'partial-failure'} as any})).toBe('PARTIAL FAILURE');
  const row=agentModelStatus({ai:{agents:{TEAM:{status:'configured',executionStatus:'cooldown',retryAfterSeconds:30,rateLimit:{'x-ratelimit-remaining-tokens':'0','api-key':'SECRET'}}}}})[0];
  expect(row).toMatchObject({executionStatus:'cooldown',retryAfterSeconds:30,rateLimit:{'x-ratelimit-remaining-tokens':'0'}});
  expect(JSON.stringify(row)).not.toContain('SECRET');
});
