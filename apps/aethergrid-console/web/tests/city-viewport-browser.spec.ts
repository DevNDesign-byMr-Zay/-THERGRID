import {expect,test} from '@playwright/test';
import {isolateBackgroundFeeds} from './helpers/isolate-background-feeds';

test('compiled city camera streams source tiles, preserves context across resize and stops in global view',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 await isolateBackgroundFeeds(page);
 const tiles:{latitude:number;longitude:number}[]=[],errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 const mesh=(id:string,latitude:number,longitude:number)=>({city:{id,lat:latitude,lon:longitude},source:{provider:'acceptance-fixture',live:true,stale:false,fetchedAt:new Date().toISOString(),attribution:'TEST FIXTURE — NOT CITY ACCURACY EVIDENCE'},buildings:[{id:`source-${id}`,heightM:80,heightSource:'height',footprint:[[-35,-35],[35,-35],[35,35],[-35,35]]}],powerAssets:[],powerLines:[],roads:[],waterAreas:[],greenAreas:[]});
 await page.route('**/api/aethergrid/geospatial/city/**',route=>route.fulfill({json:mesh('new-york',40.7549,-73.984)}));
 await page.route('**/api/aethergrid/geospatial/point?**',route=>{
  const u=new URL(route.request().url()),latitude=Number(u.searchParams.get('lat')),longitude=Number(u.searchParams.get('lon'));
  expect(u.searchParams.get('tile')).toBe('1');expect(u.searchParams.get('spatial')).toBe('1');expect(u.searchParams.get('radiusM')).toBe('450');
  tiles.push({latitude,longitude});return route.fulfill({json:mesh(`${latitude}-${longitude}`,latitude,longitude)});
 });
 await page.goto('/');
 // The initial status is an unready native-webgl placeholder. Wait for the
 // actual renderer to finish initialization, then assert Cesium was selected.
 await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready','true',{timeout:30000});
 await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer','cesium');
 await page.getByRole('button',{name:'Navigation and layers'}).click();
 await page.getByRole('navigation',{name:'City targets'}).getByRole('button',{name:/NEW YORK/}).click();
 await page.getByRole('button',{name:'Close navigation drawer'}).click();
 await expect.poll(()=>tiles.length,{timeout:30000}).toBeGreaterThan(0);
 await expect(page.locator('[data-live-city-tiles]')).toBeVisible();
 await expect.poll(async()=>Number(await page.locator('.world-stage').getAttribute('data-source-building-count'))).toBeGreaterThan(1);
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('.spatial-canvas canvas')).toBeVisible();
 const badge=(await page.locator('[data-live-city-tiles]').boundingBox())!;
 const controls=(await page.locator('.stage-controls').boundingBox())!;
 expect(badge.y>=controls.y+controls.height||badge.y+badge.height<=controls.y,
  'stream status must not obscure mobile visual-mode controls').toBe(true);
 await page.screenshot({path:'test-results/adaptive-city-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});
 const canvas=page.locator('.spatial-canvas canvas').first(),box=(await canvas.boundingBox())!;
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5,{steps:8});await page.mouse.up();
 await expect(page.locator('.cesium-widget-errorPanel')).toHaveCount(0);
 await page.screenshot({path:'test-results/adaptive-city-desktop.png'});
 await page.getByRole('navigation',{name:'Product modes'}).getByRole('button',{name:'GLOBAL',exact:true}).click();
 await expect(page.locator('.world-stage')).toHaveAttribute('data-stream-tiles','0');
 const count=tiles.length;
 // More than two stream sampling intervals: leaving city must not issue work.
 await expect.poll(async()=>{await page.waitForTimeout(2800);return tiles.length;}).toBe(count);
 expect(errors).toEqual([]);
});
