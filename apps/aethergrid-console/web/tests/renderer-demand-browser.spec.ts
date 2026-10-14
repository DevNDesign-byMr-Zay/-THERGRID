import {expect,test} from '@playwright/test';
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
});
