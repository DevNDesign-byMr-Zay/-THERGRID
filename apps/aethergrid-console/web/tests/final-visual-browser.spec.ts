import {expect,test} from '@playwright/test';

for(const width of [1366,390,844])test(`forecast scene disclosure stays readable inside responsive time controls at ${width}`,async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width,height:width===390?844:width===844?390:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('internetdisconnected'));
  await page.route('**/api/aethergrid/**',route=>['/api/aethergrid/config/public','/api/aethergrid/profile'].includes(new URL(route.request().url()).pathname)?route.continue():route.fulfill({status:503,json:{error:'Offline visual contract'}}));
  await page.route('**/api/aethergrid/weather/forecast?**',route=>route.fulfill({json:{data:{timesteps:[{time:'2026-10-13T12:00:00Z',temperatureCelsius:12}]},receipt:{live:true,fallback:false}}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Navigation and layers'}).click();
  await page.getByRole('navigation',{name:'City targets'}).getByRole('button',{name:/NEW YORK/}).click();
  await page.getByRole('button',{name:'Close navigation drawer'}).click();
  const rail=page.getByRole('region',{name:'4D time controls'});
  await rail.getByRole('button',{name:'FORECAST',exact:true}).click();
  await expect(rail.getByRole('combobox',{name:'Forecast valid time'})).toBeEnabled();
  await expect(page.locator('.scene-caption')).toContainText('CITY GEOMETRY UNAVAILABLE');
  await expect(rail.locator('.forecast-scene-badge')).toHaveCount(1);
  const badge=rail.locator('.forecast-scene-badge');
  await badge.scrollIntoViewIfNeeded();
  expect(await badge.locator('small').evaluate(node=>Number.parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(10);
  const b=(await badge.boundingBox())!,r=(await rail.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(r.y);expect(b.y+b.height).toBeLessThanOrEqual(r.y+r.height+1);
  await page.screenshot({path:`test-results/final-forecast-${width}.png`});
});

for(const width of [1366,390])test(`night illumination remains visibly labeled as presentation at ${width}`,async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width,height:width===390?844:768});
  await page.clock.setFixedTime(new Date('2026-10-13T04:00:00Z'));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('internetdisconnected'));
  await page.route('**/api/aethergrid/**',route=>['/api/aethergrid/config/public','/api/aethergrid/profile'].includes(new URL(route.request().url()).pathname)?route.continue():route.fulfill({status:503,json:{error:'Offline night contract'}}));
  await page.route('**/api/aethergrid/geospatial/city/**',route=>route.fulfill({json:{city:{id:'new-york',lat:40.7549,lon:-73.984},source:{provider:'offline-night-contract',live:true,attribution:'OFFLINE NIGHT CONTRACT — NOT CITY ACCURACY'},buildings:[{id:'roof-fixture',heightM:110,heightSource:'height',footprint:[[-60,-60],[60,-60],[60,60],[-60,60]]}],powerAssets:[],powerLines:[],roads:[],waterAreas:[],waterways:[],coastlines:[],greenAreas:[]}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Navigation and layers'}).click();
  await page.getByRole('navigation',{name:'City targets'}).getByRole('button',{name:/NEW YORK/}).click();
  await page.getByRole('button',{name:'Close navigation drawer'}).click();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-source-building-count','1');
  const rail=page.getByRole('region',{name:'4D time controls'});
  const notice=rail.locator('.illumination-scene-badge');
  await expect(notice).toHaveCount(1);
  await notice.scrollIntoViewIfNeeded();
  await expect(notice).toContainText('PRESENTATION ONLY · NOT MEASURED WINDOW LIGHTS');
  expect(await notice.locator('small').evaluate(node=>Number.parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(10);
  await page.screenshot({path:`test-results/final-night-disclosure-${width}.png`});
});
