import {expect,test} from '@playwright/test';

for (const engine of ['cesium', 'native-webgl']) {
  test(`${engine} yields GPU drawing to a compact modal and resumes with current state`, async ({page}) => {
    test.setTimeout(90000);
    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.addInitScript(() => {
      (window as any).__modalGpuDraws=0;
      for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype] as any[]) {
        for (const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
          if (typeof proto[name] !== 'function') continue;
          const original=proto[name];
          proto[name]=function(this:any,...args:any[]) {
            (window as any).__modalGpuDraws++;
            return Reflect.apply(original,this,args);
          };
        }
      }
    });
    await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('internetdisconnected'));
    await page.route('**/api/aethergrid/**',route=>['/api/aethergrid/config/public','/api/aethergrid/profile'].includes(new URL(route.request().url()).pathname)?route.continue():route.fulfill({status:503,json:{error:'Offline modal rendering contract'}}));
    await page.goto('/');
    await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready','true',{timeout:30000});
    if (engine === 'native-webgl') {
      await page.getByText('Renderer tools',{exact:true}).click();
      await page.getByRole('group',{name:'Spatial renderer',exact:true}).getByRole('button',{name:'NATIVE',exact:true}).click();
    }
    await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer',engine);
    await expect.poll(()=>page.evaluate(()=>(window as any).__modalGpuDraws)).toBeGreaterThan(0);
    await page.getByRole('button',{name:'SETTINGS',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Intelligence workspace'})).toBeVisible();
    await expect(page.locator('.world-stage')).toHaveAttribute('inert','');
    // Drain any draw already submitted before modal ownership, then observe real GPU calls.
    await page.waitForTimeout(250);
    const draws=await page.evaluate(()=>(window as any).__modalGpuDraws);
    const clock=await page.locator('.time-readout').innerText();
    await page.waitForTimeout(1800);
    expect(await page.evaluate(()=>(window as any).__modalGpuDraws),'An inaccessible spatial scene must yield GPU work to the modal').toBe(draws);
    await expect.poll(()=>page.locator('.time-readout').innerText()).not.toBe(clock);
    await page.getByRole('button',{name:'Close intelligence drawer'}).click();
    await expect.poll(()=>page.evaluate(()=>(window as any).__modalGpuDraws),{timeout:10000}).toBeGreaterThan(draws);
    await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready','true');
  });
}

test('reduced motion stops unchanged Cesium GPU draws but camera and preference changes still render',async({page})=>{
  test.setTimeout(90000);await page.setViewportSize({width:1000,height:700});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{(window as any).__gpuDraws=0;const proto:any=WebGL2RenderingContext.prototype;for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=proto[name];proto[name]=function(this:any,...args:any[]){(window as any).__gpuDraws++;return Reflect.apply(original,this,args);};}});
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('internetdisconnected'));
  await page.route('**/api/aethergrid/**',route=>['/api/aethergrid/config/public','/api/aethergrid/profile'].includes(new URL(route.request().url()).pathname)?route.continue():route.fulfill({status:503,json:{error:'Offline draw contract'}}));
  await page.route('**/api/aethergrid/geospatial/city/**',route=>route.fulfill({json:{city:{id:'new-york',lat:40.7549,lon:-73.984},source:{provider:'offline-draw-contract',live:true,attribution:'OFFLINE CONTRACT — NOT CITY ACCURACY'},buildings:[{id:'fixture',heightM:100,heightSource:'height',footprint:[[-60,-60],[60,-60],[60,60],[-60,60]]}],powerAssets:[],powerLines:[],roads:[],waterAreas:[],waterways:[],coastlines:[],greenAreas:[]}}));
  await page.goto('/');await page.getByRole('button',{name:'Navigation and layers'}).click();await page.getByRole('navigation',{name:'City targets'}).getByRole('button',{name:/NEW YORK/}).click();await page.getByRole('button',{name:'Close navigation drawer'}).click();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-source-building-count','1');await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer','cesium');
  await page.getByRole('region',{name:'4D time controls'}).getByRole('button',{name:'HISTORICAL',exact:true}).click();
  await expect.poll(async()=>{const before=await page.evaluate(()=>(window as any).__gpuDraws);await page.waitForTimeout(1200);return await page.evaluate(()=>(window as any).__gpuDraws)-before;},{timeout:15000,message:'Unchanged historical source frame must not continuously redraw'}).toBe(0);
  const clip={x:420,y:240,width:320,height:160};const pixelsBefore=await page.screenshot({clip});
  let before=await page.evaluate(()=>(window as any).__gpuDraws);await page.mouse.move(700,350);await page.mouse.wheel(0,300);await expect.poll(()=>page.evaluate(()=>(window as any).__gpuDraws)).toBeGreaterThan(before);
  expect((await page.screenshot({clip})).equals(pixelsBefore),'Camera input must change the actual spatial view').toBe(false);
  before=await page.evaluate(()=>(window as any).__gpuDraws);await page.emulateMedia({reducedMotion:'no-preference'});await expect.poll(()=>page.evaluate(()=>(window as any).__gpuDraws)).toBeGreaterThan(before);
  const continuous=await page.evaluate(()=>(window as any).__gpuDraws);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(()=>(window as any).__gpuDraws),'Normal motion must continue drawing after the preference change').toBeGreaterThan(continuous);
  await page.getByRole('button',{name:'Navigation and layers'}).click();
  await expect(page.getByRole('dialog',{name:'Navigation and layers'})).toBeVisible();
  await page.getByRole('button',{name:'Close navigation drawer'}).click();
  await expect(page.getByRole('dialog',{name:'Navigation and layers'})).not.toBeVisible();
});
