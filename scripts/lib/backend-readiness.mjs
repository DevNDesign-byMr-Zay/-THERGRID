export async function verifyBackendReadiness(text, assert, pkg, exactAethergridLegacyHtml) {
  const exactAethergridServerEntry = await text('apps/aethergrid-console/server.mjs');
  const routeFiles = [
    'auth-routes',
    'observation-http',
    'provider-routes',
    'spatial-routes',
    'quantum-routes',
    'agent-routes',
    'operator-routes',
  ];
  const routeSources = await Promise.all(
    routeFiles.map((name) => text(`apps/aethergrid-console/server/http/${name}.mjs`)),
  );
  for (const name of routeFiles)
    assert(
      exactAethergridServerEntry.includes(`./server/http/${name}.mjs`),
      `backend must mount ${name}`,
    );
  const exactAethergridServer = [exactAethergridServerEntry, ...routeSources].join('\n');
  const exactAethergridWebRuntime = await text('apps/aethergrid-console/web-runtime.mjs');
  const exactAethergridPackager = await text('scripts/assemble-aethergrid-full-app.mjs');
  const exactAethergridApp = JSON.parse(await text('apps/aethergrid-console/app.json'));
  const exactAethergridUi = JSON.parse(await text('apps/aethergrid-console/ui.json'));
  const exactAethergridWebPackage = JSON.parse(
    await text('apps/aethergrid-console/web/package.json'),
  );
  const exactAethergridWebVite = await text('apps/aethergrid-console/web/vite.config.ts');
  const exactAethergridWebReadme = await text('apps/aethergrid-console/web/README.md');
  const exactAethergridWebMain = await text('apps/aethergrid-console/web/src/main.tsx');
  const exactAethergridWebApp = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert(
    exactAethergridApp.version === exactAethergridWebPackage.version &&
      exactAethergridUi.version === exactAethergridWebPackage.version,
    'canonical app.json, ui.json and React workspace must share the v4 frontend version',
  );
  assert(
    exactAethergridApp.entrypoints?.webApp === 'web/dist/index.html' &&
      exactAethergridApp.entrypoints?.backend === 'server.mjs' &&
      exactAethergridApp.entrypoints?.legacyWebApp === 'legacy/index.html' &&
      exactAethergridApp.entrypoints?.standaloneHtml === 'legacy/standalone.html',
    'ÆTHERGRID entrypoints must identify the built React app as canonical and native v3 as legacy',
  );
  assert(
    exactAethergridApp.frontend?.canonical === true &&
      exactAethergridApp.frontend?.framework === 'react-typescript-vite' &&
      exactAethergridApp.frontend?.spatialRenderer === 'cesium-primary-native-fallback' &&
      exactAethergridApp.frontend?.privateProviderSecretsInBrowser === false &&
      exactAethergridApp.legacyCompatibility?.canonical === false,
    'app manifest must preserve the canonical React/Cesium and explicit legacy boundary',
  );
  assert(
    exactAethergridApp.visualContract?.runtimeUsesBackgroundReferenceImage === false &&
      exactAethergridUi.runtimeUsesBackgroundReferenceImage === false &&
      exactAethergridUi.runtimeComposition === 'react-typescript-cesium' &&
      exactAethergridUi.spatialModel?.renderEngine === 'cesium-primary-native-fallback' &&
      exactAethergridUi.globalWorkspace?.renderEngine === 'cesium-primary-native-fallback' &&
      exactAethergridUi.canonicalSurface?.build === 'web/dist' &&
      exactAethergridUi.legacyCompatibility?.canonical === false,
    'UI contract must identify React/Cesium as canonical without reintroducing the old reference image',
  );
  assert(
    /createCanonicalWebRuntime/u.test(exactAethergridServer) &&
      /canonicalWebRuntime\.serve\(request, response, url\)/u.test(exactAethergridServer) &&
      !/url\.pathname === '\/' \? '\/index\.html'/u.test(exactAethergridServer),
    'Node server must delegate production static serving to the canonical React runtime',
  );
  assert(
    /web['"], ['"]dist/u.test(exactAethergridWebRuntime) &&
      /canonical_web_build_missing/u.test(exactAethergridWebRuntime) &&
      /url\.pathname\.startsWith\('\/api\/'\)/u.test(exactAethergridWebRuntime) &&
      /await serveFile\(request, response, indexPath\)/u.test(exactAethergridWebRuntime),
    'canonical static runtime must serve web/dist, support SPA fallback, and never shadow API routes',
  );
  assert(
    /run\(npm, \['ci'\], WEB_ROOT\)/u.test(exactAethergridPackager) &&
      /run\(npm, \['run', 'build'\], WEB_ROOT\)/u.test(exactAethergridPackager) &&
      /web\/dist\/index\.html/u.test(exactAethergridPackager) &&
      /legacy\/index\.html/u.test(exactAethergridPackager) &&
      /legacy\/standalone\.html/u.test(exactAethergridPackager) &&
      /node_modules\/zod\/package\.json/u.test(exactAethergridPackager) &&
      /PRIVATE_BROWSER_ENV_NAMES/u.test(exactAethergridPackager),
    'full-app packaging must deterministically build React, bundle runtime dependencies, and isolate legacy compatibility',
  );
  assert(
    pkg.scripts?.['build:aethergrid-web']?.includes('apps/aethergrid-console/web') &&
      pkg.scripts?.['aethergrid-app']?.startsWith('npm run build:aethergrid-web'),
    'maintained ÆTHERGRID launch path must build the canonical React frontend first',
  );
  assert(
    pkg.scripts?.['smoke:aethergrid-app'] === 'node scripts/smoke-aethergrid-full-app.mjs' &&
      pkg.scripts?.check?.includes('npm run smoke:aethergrid-app'),
    'release check must launch the packaged canonical application, not only create its ZIP',
  );
  assert(
    exactAethergridWebPackage.private === true &&
      exactAethergridWebPackage.scripts?.build === 'tsc --noEmit && vite build' &&
      typeof exactAethergridWebPackage.dependencies?.react === 'string' &&
      typeof exactAethergridWebPackage.dependencies?.cesium === 'string',
    'canonical web workspace must remain a locked React/Cesium production build',
  );
  assert(
    /CESIUM_BASE_URL/u.test(exactAethergridWebVite) &&
      /outDir: 'dist'/u.test(exactAethergridWebVite) &&
      /'\/api': 'http:\/\/127\.0\.0\.1:8090'/u.test(exactAethergridWebVite),
    'Vite must emit dist assets, preserve Cesium assets, and proxy API calls only in development',
  );
  assert(
    /canonical/iu.test(exactAethergridWebReadme) &&
      /production/u.test(exactAethergridWebReadme) &&
      /createRoot/u.test(exactAethergridWebMain) &&
      /Product modes/u.test(exactAethergridWebApp),
    'React workspace documentation and source must describe the promoted command center',
  );
  assert(
    /<canvas id="spatialGrid"/u.test(exactAethergridLegacyHtml) &&
      !/dashboard-reference/iu.test(exactAethergridLegacyHtml),
    'native v3 source must remain available only as verified compatibility/fallback material',
  );

  for (const route of [
    '/api/aethergrid/telemetry',
    '/api/aethergrid/stream',
    '/api/aethergrid/spatial',
    '/api/aethergrid/evidence/',
    '/api/aethergrid/runtime',
    '/api/aethergrid/runtime/providers',
    '/api/aethergrid/config/public',
    '/api/aethergrid/weather/current',
    '/api/aethergrid/weather/forecast',
    '/api/aethergrid/hazards/alerts',
    '/api/aethergrid/hydrology/gauges',
    '/api/aethergrid/energy/context',
    '/api/aethergrid/transit/vehicles',
    '/api/aethergrid/transit/realtime',
    '/api/aethergrid/profile',
    '/api/aethergrid/geospatial/cities',
    '/api/aethergrid/geospatial/city/',
    '/api/aethergrid/geospatial/point',
    '/api/aethergrid/city-operations/use-cases',
    '/api/aethergrid/city-operations/analyze',
    '/api/aethergrid/environment',
    '/api/aethergrid/environment/runtime',
    '/api/aethergrid/global-live',
    '/api/aethergrid/city-live',
    '/api/aethergrid/city-live/runtime',
    '/api/aethergrid/terrain',
    '/api/aethergrid/terrain/runtime',
    '/api/aethergrid/quantum/runtime',
    '/api/aethergrid/quantum/backends',
    '/api/aethergrid/quantum/jobs',
    '/api/aethergrid/quantum/dwave/solvers',
    '/api/aethergrid/quantum/dwave/jobs',
    '/api/aethergrid/agents/',
    '/api/aethergrid/team',
    '/api/aethergrid/view',
    '/api/aethergrid/region',
    '/api/aethergrid/scenario',
    '/api/aethergrid/reset',
    '/api/aethergrid/optimize',
    '/api/aethergrid/chat',
    '/api/aethergrid/export',
  ]) {
    assert(
      exactAethergridServer.includes(route),
      `ÆTHERGRID backend must preserve maintained route: ${route}`,
    );
  }
  const operatorGraphSource = await text('apps/aethergrid-console/operator-state.mjs');
  assert(
    /dimensions: \['x', 'y', 'z', 'time'\]/u.test(operatorGraphSource) &&
      /const spatialGraph = buildSpatialGraph\(\)/u.test(exactAethergridServer),
    'ÆTHERGRID backend must build a time-indexed spatial graph',
  );
  assert(
    /function agentContext\(input = \{\}\)/u.test(exactAethergridServer) &&
      /import \{ analyzeCityUseCase \} from '\.\/analysis\/city-planning\.mjs'/u.test(
        exactAethergridServer,
      ) &&
      /import \{ CITY_USE_CASES \} from '\.\/analysis\/city-use-cases\.mjs'/u.test(
        exactAethergridServer,
      ) &&
      /externalContext: \{/u.test(exactAethergridServer) &&
      /geospatial: state\.externalContext\.geospatial/u.test(exactAethergridServer) &&
      /quantum: state\.externalContext\.quantum/u.test(exactAethergridServer),
    'ÆTHERGRID agent requests must receive bounded geospatial and quantum runtime context',
  );
  return { exactAethergridPackager };
}
