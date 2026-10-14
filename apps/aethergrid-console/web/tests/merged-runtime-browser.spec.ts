import {expect,test} from '@playwright/test';

// These requests reach the canonical Node runtime. Only unrelated data feeds
// are blocked; model, TEAM, specialist and evidence responses are not fixtures.
for(const width of [1366,390])test(`real local TEAM receipts and exact evidence survive network recovery at ${width}`,async({page,context})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width,height:width===390?844:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const configurationResponse=await page.request.get('/api/aethergrid/runtime');
  expect(configurationResponse.ok()).toBe(true);
  const configuration=await configurationResponse.json();
  for(const id of ['TEAM','AUREN','VÆLON','SOLVÆR']){
    // Fail before submitting if this server would call a paid/external model.
    expect(configuration.ai.agents[id].provider).toBe('local');
  }
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('internetdisconnected'));
  await page.route('**/api/aethergrid/**',route=>{
    const pathname=new URL(route.request().url()).pathname;
    return ['/api/aethergrid/config/public','/api/aethergrid/profile','/api/aethergrid/runtime','/api/aethergrid/team','/api/aethergrid/evidence'].includes(pathname)||pathname.startsWith('/api/aethergrid/evidence/')||pathname.startsWith('/api/aethergrid/agents/')
      ?route.continue():route.fulfill({status:503,json:{error:'Unrelated data feed unavailable during runtime acceptance'}});
  });
  await page.goto('/');
  await page.getByRole('navigation',{name:'Product modes'}).getByRole('button',{name:'AI',exact:true}).click();
  const dock=page.locator('.agent-dock');
  const models=dock.getByRole('region',{name:'Backend model configuration'});
  await expect(models).toContainText('local-team');
  async function requestTeam(prompt:string){
    await dock.getByRole('textbox',{name:'Message TEAM'}).fill(prompt);
    const replyPromise=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/aethergrid/team'&&response.request().method()==='POST');
    await dock.getByRole('button',{name:'SEND',exact:true}).click();
    const response=await replyPromise;expect(response.ok()).toBe(true);
    const result=await response.json();
    expect(result.runtime.provider).toBe('local');
    expect(result.runtime.fallbackUsed).toBe(false);
    expect(result.contributions.map((item:{agent:string})=>item.agent)).toEqual(['VÆLON','AUREN','SOLVÆR']);
    expect(result.receipt).toMatch(/^[a-f0-9]{64}$/);
    await expect(dock.locator('.agent-run-state')).toHaveText('LOCAL FALLBACK');
    await expect(dock.locator('.agent-runtime')).toContainText(result.receipt);
    return result;
  }
  let result=await requestTeam('Inspect source limitations without inventing observations');
  await dock.locator('.agent-contributions summary').click();
  for(const contribution of result.contributions){
    const article=dock.locator('.agent-contributions article').filter({hasText:contribution.receipt});
    await expect(article).toContainText('LOCAL FALLBACK');
    await expect(article).toContainText(contribution.reply);
  }
  if(width===1366){
    await context.setOffline(true);
    try{
      await models.getByRole('button',{name:'Refresh model configuration'}).click();
      await expect(models).toContainText('STALE');
      await expect(models).toContainText('local-team');
      await dock.getByRole('textbox',{name:'Message TEAM'}).fill('Offline attempt');
      await dock.getByRole('button',{name:'SEND',exact:true}).click();
      await expect(dock.locator('.agent-run-state')).toHaveText('FAILED');
      await expect(dock.getByRole('button',{name:'REVIEW EVIDENCE'})).toHaveCount(0);
      await page.screenshot({path:'test-results/merged-runtime-offline.png'});
    }finally{await context.setOffline(false);}
    await models.getByRole('button',{name:'Refresh model configuration'}).click();
    await expect(models).toContainText('BACKEND CONFIGURATION');
    await expect(models).not.toContainText('STALE');
    result=await requestTeam('Recovered request after network reconnect');
  }
  await page.screenshot({path:`test-results/merged-runtime-team-${width}.png`});
  await dock.getByRole('button',{name:'REVIEW EVIDENCE'}).click();
  await expect(page.locator('.evidence-detail')).toContainText(result.receipt);
  for(const contribution of result.contributions)await expect(page.locator('.evidence-detail')).toContainText(contribution.receipt);
  await page.screenshot({path:`test-results/merged-runtime-evidence-${width}.png`});
  expect(errors).toEqual([]);
});
