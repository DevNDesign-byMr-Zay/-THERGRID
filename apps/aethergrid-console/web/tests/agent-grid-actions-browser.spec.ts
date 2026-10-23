import {expect,test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

for(const width of [1366,390])test(`completed grid actions change actual controls, undo restores them, history and stopped responses never reapply at ${width}`,async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width,height:width===390?844:900});
  await page.addInitScript(()=>{const original=window.fetch;window.fetch=async(input,init)=>{
    if(String(input).endsWith('/api/aethergrid/team')&&JSON.parse(String(init?.body||'{}')).message==='Slow'){
      await new Promise<void>(resolve=>{(window as any).__releaseGrid=resolve;});
      return new Response(JSON.stringify({reply:'Late',receipt:'b'.repeat(64),runtime:{provider:'groq',model:'m',executionStatus:'succeeded'},actions:[{type:'set_view',view:'xray'}]}),{headers:{'content-type':'application/json'}});
    }return original(input,init);
  };});
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await page.route('**/api/aethergrid/**',route=>['/api/aethergrid/config/public','/api/aethergrid/profile'].includes(new URL(route.request().url()).pathname)?route.continue():route.fulfill({status:503,json:{error:'Offline'}}));
  await page.route('**/api/aethergrid/runtime',route=>route.fulfill({json:{ai:{agents:{TEAM:{provider:'groq',model:'configured-model',status:'configured',skills:['set_view','set_time'],lastExecution:null}}}}}));
  await page.route('**/api/aethergrid/team',route=>{
    const {message}=route.request().postDataJSON();
    if(message==='Fail')return route.fulfill({status:503,json:{error:'Provider unavailable'}});
    return route.fulfill({json:{reply:message,receipt:'a'.repeat(64),runtime:{provider:'groq',model:'m',executionStatus:message==='Fallback'?'cooldown':'succeeded',fallbackUsed:message==='Fallback',retryAfterSeconds:message==='Fallback'?30:null,rateLimit:{'x-ratelimit-remaining-tokens':'12'}},actions:message==='Malformed'?[{type:'set_view',view:'invalid'}]:[{type:'set_view',view:'wireframe'},{type:'set_layer',layer:'roads',enabled:false},{type:'set_time',mode:'historical',at:'2026-10-22T12:00:00Z'}]}});
  });
  await page.goto('/');
  await page.getByRole('navigation',{name:'Product modes'}).getByRole('button',{name:'AI',exact:true}).click();
  const dock=page.locator('.agent-dock');
  const send=async(message:string)=>{await dock.getByRole('textbox',{name:'Message TEAM'}).fill(message);await dock.getByRole('button',{name:'SEND',exact:true}).click();};
  await expect(dock.getByRole('region',{name:'Backend model configuration'})).toContainText('set_view');
  await mkdir('/tmp/aethergrid-agent-ui',{recursive:true});
  await dock.getByRole('region',{name:'Backend model configuration'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`/tmp/aethergrid-agent-ui/models-${width}.png`});
  await send('Change');
  await expect(dock.getByRole('region',{name:'Grid action effects'})).toContainText('wireframe');
  await expect(page.locator('.live-cluster')).toContainText('HISTORICAL');
  await expect(page.locator('.visual-modes button').filter({hasText:/^WIREFRAME$/})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.layer-control').filter({has:page.locator('span',{hasText:/^ROADS$/})}).locator('input[type=checkbox]')).not.toBeChecked();
  await dock.getByRole('region',{name:'Grid action effects'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`/tmp/aethergrid-agent-ui/actions-${width}.png`});
  await dock.getByRole('button',{name:'Undo grid changes'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.visual-modes button').filter({hasText:/^SOLID$/})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.live-cluster')).toContainText('LIVE');
  for(const message of ['Malformed','Fallback','Fail']){await send(message);await expect(dock.locator('.agent-run-state')).not.toHaveText('RUNNING');await expect(page.locator('.visual-modes button').filter({hasText:/^SOLID$/})).toHaveAttribute('aria-pressed','true');}
  await send('Slow');await dock.getByRole('button',{name:'STOP WAITING'}).click();
  await page.evaluate(()=>(window as any).__releaseGrid());
  await expect(dock.locator('.agent-run-state')).toHaveText('STOPPED WAITING');
  await dock.getByText(/Task history · TEAM/).click();
  await dock.getByRole('button',{name:'Review task: Change',exact:true}).click();
  await expect(page.locator('.visual-modes button').filter({hasText:/^SOLID$/})).toHaveAttribute('aria-pressed','true');
  await expect(dock.getByRole('button',{name:'Undo grid changes'})).toHaveCount(0);
});
