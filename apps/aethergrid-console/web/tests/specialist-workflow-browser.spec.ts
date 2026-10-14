import {expect,test} from '@playwright/test';

async function openSpecialists(page:any,width=1366,beforeNavigation?:()=>Promise<void>){
  await page.setViewportSize({width,height:width===390?844:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/*',(route:any)=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('internetdisconnected'));
  await page.route('**/api/aethergrid/**',(route:any)=>['/api/aethergrid/config/public','/api/aethergrid/profile'].includes(new URL(route.request().url()).pathname)?route.continue():route.fulfill({status:503,json:{error:'Offline workflow contract'}}));
  await page.route('**/api/aethergrid/runtime',(route:any)=>route.fulfill({json:{ai:{agents:{TEAM:{provider:'offline-contract',model:'configured-team',status:'configured'},AUREN:{provider:'offline-contract',model:'configured-auren',status:'configured'}}}}}));
  await page.route(/\/api\/aethergrid\/(team|agents\/[^?]+)$/,(route:any)=>{
    const {message}=route.request().postDataJSON();
    if(message==='Fail this request')return route.fulfill({status:503,json:{error:'Provider unavailable'}});
    return route.fulfill({json:{reply:`Analysis for ${message}`,receipt:`receipt-${message}`,runtime:{agent:'TEAM',provider:'offline-contract',model:`executed-${message}`,fallbackUsed:false,latencyMs:12},contributions:[{agent:'AUREN',reply:`Spatial contribution ${message}`,receipt:`contribution-${message}`,runtime:{provider:'offline-contract',model:'auren-execution',fallbackUsed:false,latencyMs:5}}],evidence:{id:`evidence-${message}`,title:`Evidence ${message}`}}});
  });
  await page.route('**/api/aethergrid/evidence/evidence-First',(route:any)=>route.fulfill({json:{evidence:{id:'evidence-First',title:'First evidence record',type:'analysis',receipt:'first-evidence-receipt',details:{source:'First task'}}}}));
  await beforeNavigation?.();
  await page.goto('/');
  await page.getByRole('navigation',{name:'Product modes'}).getByRole('button',{name:'AI',exact:true}).click();
  return page.locator('.agent-dock');
}

for(const width of [1366,390])test(`reviewing a previous specialist task preserves its model, contribution and evidence at ${width}`,async({page})=>{
  test.setTimeout(180000);const dock=await openSpecialists(page,width);
  const configuration=dock.getByRole('region',{name:'Backend model configuration'});
  await expect(configuration).toContainText('configured-team');
  await expect(configuration).toContainText('Configuration does not verify an execution');
  for(const prompt of ['First','Second']){
    await dock.getByRole('textbox',{name:'Message TEAM'}).fill(prompt);await dock.getByRole('button',{name:'SEND',exact:true}).click();
    await expect(dock.locator('.agent-runtime')).toContainText(`executed-${prompt}`);
  }
  await dock.getByText(/Task history · TEAM/).click();
  await dock.getByRole('button',{name:'Review task: First',exact:true}).click();
  await expect(dock.locator('.agent-runtime')).toContainText('executed-First');
  await expect(dock.locator('.agent-runtime')).not.toContainText('executed-Second');
  await dock.getByText(/Specialist contributions/).click();
  await expect(dock.locator('.agent-contributions')).toContainText('Spatial contribution First');
  await page.route('**/api/aethergrid/runtime',route=>route.fulfill({status:503,json:{error:'Runtime unavailable'}}));
  await configuration.getByRole('button',{name:'Refresh model configuration'}).click();
  await expect(configuration).toContainText('STALE');await expect(configuration).toContainText('configured-team');
  await page.screenshot({path:`test-results/step6-model-configuration-${width}.png`});
  await dock.locator('.agent-reviewed-task').scrollIntoViewIfNeeded();
  await page.screenshot({path:`test-results/step6-task-review-${width}.png`});
  await dock.getByRole('button',{name:'REVIEW EVIDENCE'}).click();
  await expect(page.locator('.evidence-detail')).toContainText('first-evidence-receipt');
  await page.getByRole('navigation',{name:'Intelligence workspace'}).getByRole('button',{name:'AI',exact:true}).click();
  await dock.getByRole('textbox',{name:'Message TEAM'}).fill('Fail this request');await dock.getByRole('button',{name:'SEND',exact:true}).click();
  await expect(dock.locator('.agent-run-state')).toHaveText('FAILED');
  await expect(dock.locator('.agent-task-history')).toContainText('Provider unavailable');
  await expect(dock.getByRole('button',{name:'REVIEW EVIDENCE'})).toHaveCount(0);
});

test('stopped transport and a late response cannot replace the next specialist task',async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(()=>{const original=window.fetch;window.fetch=async(input,init)=>{
    if(String(input).endsWith('/api/aethergrid/team')&&JSON.parse(String(init?.body||'{}')).message==='Slow task'){
      await new Promise<void>(resolve=>{(window as any).__releaseOldSpecialist=resolve;});
      return new Response(JSON.stringify({reply:'LATE OLD RESPONSE',receipt:'old-receipt',runtime:{provider:'fixture',model:'late-model'}}),{status:200,headers:{'content-type':'application/json'}});
    }
    return original(input,init);
  };});
  const dock=await openSpecialists(page);
  await dock.getByRole('textbox',{name:'Message TEAM'}).fill('Slow task');await dock.getByRole('button',{name:'SEND',exact:true}).click();
  await dock.getByRole('button',{name:'STOP WAITING'}).click();
  await expect(dock.locator('.agent-run-state')).toHaveText('STOPPED WAITING');
  await dock.getByRole('textbox',{name:'Message TEAM'}).fill('New task');await dock.getByRole('button',{name:'SEND',exact:true}).click();
  await expect(dock.locator('.agent-runtime')).toContainText('executed-New task');
  await page.evaluate(()=>(window as any).__releaseOldSpecialist());
  await page.waitForTimeout(200);
  await expect(dock.locator('.agent-runtime')).toContainText('executed-New task');
  await expect(dock).not.toContainText('LATE OLD RESPONSE');
  await dock.getByText(/Task history · TEAM/).click();
  await expect(dock.locator('.agent-task-history')).toContainText('STOPPED WAITING');
});

test('picked building guides AUREN analysis into comparison and exact evidence review',async({page})=>{
  test.setTimeout(180000);
  let requested:any=null;
  const dock=await openSpecialists(page,1366,async()=>{
  await page.route('**/api/aethergrid/geospatial/city/**',route=>route.fulfill({json:{city:{id:'new-york',lat:40.7549,lon:-73.984},source:{provider:'offline-workflow-contract',live:true,attribution:'OFFLINE WORKFLOW GEOMETRY FIXTURE'},buildings:[{id:'roof-fixture',heightM:110,heightSource:'height',roofShape:'pyramidal',roofHeightM:35,footprint:[[-60,-60],[60,-60],[60,60],[-60,60]]}],powerAssets:[],powerLines:[],roads:[],waterAreas:[],waterways:[],coastlines:[],greenAreas:[]}}));
  await page.route('**/api/aethergrid/agents/**',route=>{
    requested=route.request().postDataJSON();
    return route.fulfill({json:{reply:'Building analysis from the authorized endpoint',receipt:'entity-analysis-receipt',runtime:{agent:'AUREN',provider:'offline-contract',model:'actual-auren-model',fallbackUsed:false,latencyMs:12},evidence:{id:'evidence-First'}}});
  });
  });
  await page.getByRole('button',{name:'Close intelligence drawer'}).click();
  await page.getByRole('button',{name:'Navigation and layers'}).click();
  await page.getByRole('navigation',{name:'City targets'}).getByRole('button',{name:/NEW YORK/}).click();
  await page.getByRole('button',{name:'Close navigation drawer'}).click();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-source-building-count','1');
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready','true');
  await expect(page.locator('.journey-status')).not.toBeVisible();
  await page.mouse.click(680,395);
  await page.getByRole('button',{name:'INTEL',exact:true}).click();
  await page.getByLabel('Inspector view').selectOption('entity');
  await expect(page.locator('.entity-dossier')).toContainText('roof-fixture');
  await page.getByRole('button',{name:'ANALYZE WITH AUREN',exact:true}).click();
  await expect(dock.getByRole('textbox',{name:'Message AUREN'})).toHaveValue(/roof-fixture/);
  expect(requested,'Entity handoff must wait for operator submission').toBeNull();
  await dock.getByRole('button',{name:'SEND',exact:true}).click();
  await expect(dock.locator('.agent-runtime')).toContainText('actual-auren-model');
  expect(requested.context.selectedEntity.sourceFeatureId).toBe('roof-fixture');
  expect(requested.context.selectedEntity.kind).toBe('building');
  await expect(dock.locator('.agent-reviewed-task')).toContainText('roof-fixture');
  await dock.getByRole('button',{name:'COMPARE SCENARIOS'}).click();
  await expect(page.getByRole('button',{name:'EXPORT SCENE JSON'})).toBeVisible();
  await page.getByRole('navigation',{name:'Intelligence workspace'}).getByRole('button',{name:'AI',exact:true}).click();
  await dock.getByRole('button',{name:'REVIEW EVIDENCE'}).click();
  await expect(page.locator('.evidence-detail')).toContainText('first-evidence-receipt');
});
