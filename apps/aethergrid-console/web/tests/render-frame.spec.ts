import {expect,test} from '@playwright/test';
test('render frames ignore live-clock metadata while retaining source, range and modeled effect changes',async()=>{
  const module=await import('../src/time/render-frame').catch(()=>null);expect(module).not.toBeNull();
  const original:any={iso:'2026-10-13T12:00:00Z',mode:'historical',sourceTime:'2026-10-13T11:00:00Z',liveReferenceIso:'2026-10-13T13:00:00Z',range:{start:'2026-10-13T12:00:00Z',end:'2026-10-13T13:00:00Z'},scenarioVisual:{stressFactor:1.1,weatherRisk:0,storageStress:0,renewableBias:0}};
  const key=module!.spatialRenderFrameKey(original);expect(module!.spatialRenderFrameKey({...original,liveReferenceIso:'2026-10-13T14:00:00Z'})).toBe(key);
  for(const change of [{iso:'2026-10-13T12:01:00Z'},{mode:'forecast'},{sourceTime:'2026-10-13T11:01:00Z'},{range:{...original.range,end:'2026-10-13T14:00:00Z'}},{scenarioVisual:{...original.scenarioVisual,stressFactor:1.8}}])expect(module!.spatialRenderFrameKey({...original,...change})).not.toBe(key);
  const frame=module!.spatialRenderFrame(original);original.range.end='replaced';original.scenarioVisual.stressFactor=5;expect(frame.range?.end).toBe('2026-10-13T13:00:00Z');expect(frame.scenarioVisual?.stressFactor).toBe(1.1);
});
