import {expect,test} from '@playwright/test';

test('existing D-Wave controls stay held while IBM discovery remains available',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  let dwaveRequests=0;
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort('internetdisconnected'));
  await page.route('**/api/aethergrid/**',route=>['/api/aethergrid/config/public','/api/aethergrid/profile'].includes(new URL(route.request().url()).pathname)?route.continue():route.fulfill({status:503,json:{error:'Offline quantum contract'}}));
  await page.route('**/api/aethergrid/quantum/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.includes('/dwave'))dwaveRequests++;
    const body=path.endsWith('/runtime')?{provider:'ibm',mode:'configured',defaultBackend:'ibm-offline-fixture',configured:true}:path.endsWith('/backends')?{backends:[{name:'ibm-offline-fixture',status:'online',qubits:127}]}:path.endsWith('/jobs')?{jobs:[]}:{data:{status:'configured',solvers:[{id:'configured-dwave-fixture'}]}};
    return route.fulfill({json:body});
  });
  await page.goto('/');
  await page.getByRole('navigation',{name:'Product modes'}).getByRole('button',{name:'QUANTUM',exact:true}).click();
  await expect(page.locator('.quantum-panel')).toContainText('ibm-offline-fixture');
  await page.getByRole('button',{name:'ANNEAL / D-WAVE',exact:true}).click();
  const held=page.locator('.dwave-workspace');
  await expect(held).toContainText('UNCONFIGURED · ON HOLD');
  await expect(held.getByRole('button',{name:'SUBMIT CONFIRMED D-WAVE PROBLEM'})).toBeDisabled();
  for(const field of await held.locator('input,select,textarea').all())await expect(field).toBeDisabled();
  expect(dwaveRequests).toBe(0);
  await page.screenshot({path:'test-results/dwave-held-390.png'});
});

test('Open Quantum discovery searches provider metadata and refreshes without job submission', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const methods: string[] = [];
  let calls = 0;
  await page.route('**/api/aethergrid/quantum/openquantum/**', (route) => {
    methods.push(route.request().method());
    calls += 1;
    return route.fulfill({ json: calls === 1 ? {
      status: 'ready', live: true, backends: [
        { name: 'Fixture QPU', shortCode: 'fixture:qpu', providerId: 'vendor', type: 'QPU', status: 'Online', queueDepth: 0, acceptingJobs: true },
        { name: 'Fixture simulator', shortCode: 'fixture:sim', providerId: 'vendor', type: 'SIMULATOR', status: 'Online', queueDepth: null, acceptingJobs: null }
      ]
    } : { status: 'authentication_failed', live: false, backends: [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'QUANTUM', exact: true }).click();
  await page.getByRole('button', { name: 'OPEN QUANTUM', exact: true }).click();
  const discovery = page.getByRole('group', { name: 'Open Quantum backend discovery' });
  await discovery.getByRole('button', { name: 'Discover backends' }).click();
  await expect(discovery.getByRole('status')).toHaveText('Authenticated. 2 backends returned.');
  await expect(discovery.getByText('Hardware QPU', { exact: false })).toBeVisible();
  await discovery.getByRole('searchbox', { name: 'Filter backends' }).fill('fixture:sim');
  await expect(discovery.getByText('Fixture QPU', { exact: true })).toHaveCount(0);
  await expect(discovery.getByText('Fixture simulator', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/open-quantum-discovery-fixture-390.png' });
  await discovery.getByRole('button', { name: 'Refresh backends' }).click();
  await expect(discovery.getByRole('status')).toHaveText('Open Quantum rejected authentication.');
  expect(methods).toEqual(['GET', 'GET']);
});
