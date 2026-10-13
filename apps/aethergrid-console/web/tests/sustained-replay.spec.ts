import {expect,test} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

test('15-minute compiled modeled replay retains a working Cesium scene',async({page,browser})=>{
  test.skip(process.env.AETHERGRID_LONG_ACCEPTANCE!=='1','Explicit extended acceptance; not part of the 15-minute CI job.');
  test.setTimeout(1_100_000);
  await page.setViewportSize({width:1366,height:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const telemetry={rafCount:0,intervals:[] as number[],contextLosses:0};(window as any).__replayTelemetry=telemetry;
    let previous=0;function frame(now:number){telemetry.rafCount++;if(previous){telemetry.intervals.push(now-previous);if(telemetry.intervals.length>1024)telemetry.intervals.shift();}previous=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
    document.addEventListener('webglcontextlost',()=>telemetry.contextLosses++,true);
    localStorage.setItem('aethergrid.operator.scenarios.v4',JSON.stringify([{
      schemaVersion:'aethergrid.operator-scenario.v1',kind:'operator-scenario',authoritative:false,modeled:true,
      id:'sustained-offline-model',version:1,parentScenarioId:null,name:'Sustained offline replay',description:'OFFLINE PERFORMANCE CONTRACT',status:'draft',template:'custom',
      parameters:{loadMultiplierPercent:110,renewableAvailabilityPercent:100,storageReservePercent:18,weatherRiskPercent:20},
      startIso:'2026-10-13T12:00:00.000Z',endIso:'2026-10-13T13:00:00.000Z',createdAt:'2026-10-13T11:00:00Z',updatedAt:'2026-10-13T11:00:00Z',assumptions:[],
      references:{canonicalEntityIds:[],incidentIds:[],observationIds:[],regions:['new-york']},
      baseline:{capturedAt:'2026-10-13T11:00:00Z',temporal:{iso:'2026-10-13T12:00:00Z',mode:'live',liveReferenceIso:'2026-10-13T12:00:00Z'},region:'new-york',positionedEntityCount:0,analyticalEdgeCount:0,totalTreeDistanceMeters:0,maximumPairDistanceMeters:0}
    }]));
  });
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('internetdisconnected'));
  await page.route('**/api/aethergrid/**',route=>['/api/aethergrid/config/public','/api/aethergrid/profile'].includes(new URL(route.request().url()).pathname)?route.continue():route.fulfill({status:503,json:{error:'Offline sustained replay contract'}}));
  await page.route('**/api/aethergrid/geospatial/city/**',route=>route.fulfill({json:{city:{id:'new-york',lat:40.7549,lon:-73.984},source:{provider:'offline-performance-contract',live:true,attribution:'OFFLINE PERFORMANCE CONTRACT — NOT CITY ACCURACY'},buildings:[{id:'roof-fixture',heightM:110,heightSource:'height',roofShape:'pyramidal',roofHeightM:35,footprint:[[-60,-60],[60,-60],[60,60],[-60,60]]}],powerAssets:[],powerLines:[],roads:[],waterAreas:[],waterways:[],coastlines:[],greenAreas:[]}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Navigation and layers'}).click();
  await page.getByRole('navigation',{name:'City targets'}).getByRole('button',{name:/NEW YORK/}).click();
  await page.getByRole('button',{name:'Close navigation drawer'}).click();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-source-building-count','1');
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready','true');
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  async function sample(){
    const metrics=await cdp.send('Performance.getMetrics');
    const presentation=await page.evaluate(()=>{
      const t=(window as any).__replayTelemetry,sorted=t.intervals.slice().sort((a:number,b:number)=>a-b);
      const canvas=document.querySelector('.cesium-widget canvas') as HTMLCanvasElement|null;
      const gl=canvas?.getContext('webgl2')??canvas?.getContext('webgl');const ext=gl?.getExtension('WEBGL_debug_renderer_info');
      return {rafCount:t.rafCount,rafIntervalP50Ms:sorted[Math.floor(sorted.length*.5)]??null,rafIntervalP95Ms:sorted[Math.floor(sorted.length*.95)]??null,contextLosses:t.contextLosses,gpuRenderer:ext?gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,canvasCount:document.querySelectorAll('canvas').length,domNodes:document.getElementsByTagName('*').length};
    });
    return {elapsedMs:Date.now()-started,cursor:await page.locator('.temporal-rail output').getAttribute('data-cursor'),...presentation,jsHeapUsedBytes:metrics.metrics.find((m:any)=>m.name==='JSHeapUsedSize')?.value??null};
  }
  const started=Date.now();
  await page.waitForTimeout(10_000);const baseline=await sample();
  await page.getByRole('navigation',{name:'Product modes'}).getByRole('button',{name:'SCENARIOS',exact:true}).click();
  await page.getByRole('button',{name:'ACTIVATE MODEL',exact:true}).click();
  await page.getByRole('button',{name:'Close intelligence drawer'}).click();
  const rail=page.getByRole('region',{name:'4D time controls'});
  await rail.getByRole('combobox',{name:'Replay speed'}).selectOption('1');
  await rail.getByRole('button',{name:'Play modeled scenario'}).click();
  const playbackStarted=Date.now(),samples=[];
  while(Date.now()-playbackStarted<900_000){
    await page.waitForTimeout(Math.min(30_000,900_000-(Date.now()-playbackStarted)));
    samples.push(await sample());
    expect(samples.at(-1)!.contextLosses).toBe(0);
    await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer','cesium');
    await expect(page.locator('.cesium-widget-errorPanel')).toHaveCount(0);
    console.info(`Sustained replay: ${Math.round((Date.now()-playbackStarted)/1000)}s · ${samples.at(-1)!.cursor}`);
  }
  await rail.getByRole('button',{name:'Pause modeled scenario'}).click();
  const final=await sample();
  const report={browser:browser.version(),fixture:true,softwareGpu:true,elapsedPlaybackMs:Date.now()-playbackStarted,baseline,samples,final,errors,
    limitations:['rAF intervals measure browser scheduling, not GPU frame rate.','Software-rendered Chromium does not certify physical desktop/mobile GPUs.','Credentialed 3D-tile/terrain loading is unavailable; actual offline source footprint geometry is tested.','Renderer-private primitive counters are unavailable; canvas/DOM and JS heap counters are reported.']};
  await mkdir(test.info().outputDir,{recursive:true});await writeFile(path.join(test.info().outputDir,'sustained-replay.json'),JSON.stringify(report,null,2));
  await page.screenshot({path:path.join(test.info().outputDir,'sustained-replay.png')});
  expect(report.elapsedPlaybackMs).toBeGreaterThanOrEqual(900_000);expect(errors).toEqual([]);
  expect(Date.parse(final.cursor!)-Date.parse('2026-10-13T12:00:00Z')).toBeGreaterThanOrEqual(890_000);
  expect(final.canvasCount).toBe(baseline.canvasCount);
});
