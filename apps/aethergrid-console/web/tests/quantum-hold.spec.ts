import { expect, test } from '@playwright/test';
import { loadDwaveJob, loadDwaveResult, loadDwaveSolvers, submitDwaveJob, loadQuantumRuntime } from '../src/services/quantum-client';

test('held D-Wave cannot discover, poll or submit even when a server reports configured', async () => {
  const original = globalThis.fetch;
  const requests: string[]=[];
  globalThis.fetch=(async (url: string) => { requests.push(String(url)); return {ok:true,json:async()=>({data:{status:'configured',solvers:[{id:'real-solver'}]},status:'configured'})}; }) as any;
  try {
    for(const call of [()=>loadDwaveSolvers(),()=>loadDwaveJob('job'),()=>loadDwaveResult('job'),()=>submitDwaveJob({solver:'real-solver',problemType:'qubo',problemPayload:{},confirmSubmission:true})])
      await expect(call()).rejects.toThrow(/on hold/i);
    expect(requests).toHaveLength(0);
    await loadQuantumRuntime();
    expect(requests).toHaveLength(1); expect(requests[0]).not.toContain('/dwave');
  } finally { globalThis.fetch=original; }
});
