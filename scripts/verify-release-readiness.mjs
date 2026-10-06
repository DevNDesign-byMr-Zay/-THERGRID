import { access, readFile } from 'node:fs/promises';

const REQUIRED_FILES = Object.freeze([
  'Dockerfile',
  'compose.yml',
  'docker-compose.yml',
  '.env.example',
  'package-lock.json',
  'jsconfig.json',
  'jsconfig.strict-renderer.json',
  '.repo-class.json',
  'docs/PROJECT_SCOPE.md',
  'src/error-reporting.mjs',
  'src/operator-console-capabilities.mjs',
  'src/operator-console-server.mjs',
  'src/operator-console-state.mjs',
  'apps/operator-console/index.html',
  'apps/operator-console/app.json',
  'apps/operator-console/ui.json',
  'apps/operator-console/README.md',
  'apps/operator-console/styles.css',
  'apps/operator-console/app.js',
  'apps/operator-console/model-logos.js',
  'apps/operator-console/assets/reference/nyc-grid.svg',
  'apps/operator-console/assets/brand/aethergrid-logo-transparent.webp',
  'apps/operator-console/assets/brand/agents/solvaer.webp',
  'apps/operator-console/assets/brand/agents/auren.webp',
  'apps/operator-console/assets/brand/agents/vaelon.webp',
  'apps/aethergrid-console/index.html',
  'apps/aethergrid-console/styles.css',
  'apps/aethergrid-console/app.js',
  'apps/aethergrid-console/server.mjs',
  'apps/aethergrid-console/web-runtime.mjs',
  'apps/aethergrid-console/web/package.json',
  'apps/aethergrid-console/web/package-lock.json',
  'apps/aethergrid-console/web/vite.config.ts',
  'apps/aethergrid-console/web/index.html',
  'apps/aethergrid-console/web/src/main.tsx',
  'apps/aethergrid-console/web/src/app/App.tsx',
  'apps/aethergrid-console/web/README.md',
  'apps/aethergrid-console/agent-config.mjs',
  'apps/aethergrid-console/ai-runtime.mjs',
  'apps/aethergrid-console/profile-store.mjs',
  'apps/aethergrid-console/geo-runtime.mjs',
  'apps/aethergrid-console/terrain-runtime.mjs',
  'apps/aethergrid-console/quantum-runtime.mjs',
  'apps/aethergrid-console/providers/coordinate-validator.mjs',
  'apps/aethergrid-console/app.json',
  'apps/aethergrid-console/ui.json',
  'apps/aethergrid-console/manifest.webmanifest',
  'apps/aethergrid-console/sw.js',
  'apps/aethergrid-console/README.md',
  'apps/aethergrid-console/.env.example',
  'apps/aethergrid-console/START-AETHERGRID.ps1',
  'apps/aethergrid-console/STOP-AETHERGRID.ps1',
  'apps/aethergrid-console/START-AETHERGRID.cmd',
  'apps/aethergrid-console/assets/brand/aethergrid-logo.webp',
  'apps/aethergrid-console/assets/brand/vaelon.webp',
  'apps/aethergrid-console/assets/brand/auren.webp',
  'apps/aethergrid-console/assets/brand/solvaer.webp',
  'docs/AETHERGRID_FUNCTIONAL_PLAN.md',
  'docs/BRAND_ASSETS.md',
  'docs/OPERATOR_CONSOLE.md',
  'CHANGELOG.md',
  'README.md',
  'docs/ARCHITECTURE.md',
  'docs/ROADMAP.md',
  'docs/RELEASE_READINESS.md',
  '.github/workflows/ci.yml',
  '.github/workflows/aethergrid-v4-web.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/release.yml',
  '.github/workflows/dependency-freshness.yml',
  '.github/dependabot.yml',
  'SECURITY.md',
  'CONTRIBUTING.md',
  '.github/CODEOWNERS',
  '.github/pull_request_template.md',
  'scripts/create-release-manifest.mjs',
  'scripts/assemble-aethergrid-package.mjs',
  'scripts/assemble-aethergrid-full-app.mjs',
  'scripts/smoke-aethergrid-full-app.mjs',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function main() {
  const root = new URL('../', import.meta.url);
  await Promise.all(REQUIRED_FILES.map((path) => access(new URL(path, root))));

  const [
    pkg,
    changelog,
    readme,
    ci,
    v4Web,
    codeql,
    release,
    dependencyFreshness,
    envExample,
    dependabot,
    classification,
    projectScope,
    lockfile,
    typeConfig,
    strictRendererTypeConfig,
  ] = await Promise.all([
    text('package.json').then(JSON.parse),
    text('CHANGELOG.md'),
    text('README.md'),
    text('.github/workflows/ci.yml'),
    text('.github/workflows/aethergrid-v4-web.yml'),
    text('.github/workflows/codeql.yml'),
    text('.github/workflows/release.yml'),
    text('.github/workflows/dependency-freshness.yml'),
    text('.env.example'),
    text('.github/dependabot.yml'),
    text('.repo-class.json').then(JSON.parse),
    text('docs/PROJECT_SCOPE.md'),
    text('package-lock.json').then(JSON.parse),
    text('jsconfig.json').then(JSON.parse),
    text('jsconfig.strict-renderer.json').then(JSON.parse),
  ]);

  assert(/^\d+\.\d+\.\d+$/u.test(pkg.version), 'package version must be semantic');
  assert(pkg.private === true, 'THERGRID package must remain private');
  assert(pkg.type === 'module', 'THERGRID must remain ESM');
  assert(
    pkg.main === 'src/platform-health-service.mjs',
    'package main must expose the application service entrypoint',
  );
  assert(
    pkg.exports === './src/platform-health-service.mjs',
    'package exports must expose the application service entrypoint',
  );
  assert(
    pkg.scripts?.start === 'node src/platform-health-service.mjs',
    'npm start must launch the application service entrypoint',
  );
  assert(
    classification.primaryClass === 'application-service',
    'repository classification must remain application-service',
  );
  assert(
    classification.excludedClasses?.includes('infrastructure-as-code'),
    'repository classification must explicitly exclude infrastructure-as-code',
  );
  assert(
    /not an infrastructure-as-code repository/iu.test(projectScope),
    'project scope must preserve the application-vs-IaC boundary',
  );
  assert(
    typeof pkg.engines?.node === 'string' && pkg.engines.node.includes('22'),
    'Node 22 runtime contract is required',
  );
  assert(
    typeConfig.compilerOptions?.checkJs === true,
    'maintained JavaScript checkJs must remain enabled',
  );
  for (const path of [
    'src/contracts.mjs',
    'src/twin.mjs',
    'src/planning.mjs',
    'src/simulation.mjs',
    'src/decision-receipt.mjs',
    'src/solver-evaluation.mjs',
    'src/solver-adapter.mjs',
    'src/holographic-renderer-contract.mjs',
    'src/holographic-render-packet-policy.mjs',
  ]) {
    assert(
      typeConfig.include?.includes(path),
      `critical maintained typecheck surface missing: ${path}`,
    );
  }
  assert(
    strictRendererTypeConfig.compilerOptions?.strict === true &&
      strictRendererTypeConfig.compilerOptions?.checkJs === true &&
      strictRendererTypeConfig.compilerOptions?.noImplicitAny === false,
    'renderer evidence safety boundary must remain strict checkJs',
  );
  for (const path of [
    'src/holographic-renderer-contract.mjs',
    'src/holographic-render-packet-policy.mjs',
  ]) {
    assert(
      strictRendererTypeConfig.include?.includes(path),
      `strict renderer typecheck surface missing: ${path}`,
    );
  }

  const expectedDevToolchain = Object.freeze({
    eslint: '10.10.0',
    prettier: '3.6.2',
    typescript: '5.9.3',
  });
  assert(
    JSON.stringify(pkg.devDependencies) === JSON.stringify(expectedDevToolchain),
    'development toolchain must stay exactly pinned',
  );
  assert(
    JSON.stringify(lockfile.packages?.['']?.devDependencies) ===
      JSON.stringify(expectedDevToolchain),
    'package-lock root dev toolchain must match package.json',
  );
  for (const [name, version] of Object.entries(expectedDevToolchain)) {
    assert(
      lockfile.packages?.[`node_modules/${name}`]?.version === version,
      `locked ${name} version must remain ${version}`,
    );
  }
  assert(!/npx\s/u.test(pkg.scripts.lint), 'lint must use the locally locked eslint binary');
  assert(
    !/npx\s/u.test(pkg.scripts['format:check']),
    'format check must use the locally locked prettier binary',
  );
  assert(
    !/npx\s/u.test(pkg.scripts.typecheck),
    'typecheck must use the locally locked TypeScript binary',
  );

  for (const name of [
    'coverage',
    'syntax',
    'demo',
    'dashboard-demo',
    'operator-console',
    'lint',
    'typecheck',
    'typecheck:strict-renderer',
    'format:check',
    'check',
    'verify:release',
    'package:aethergrid',
    'aethergrid-app',
    'package:aethergrid-app',
  ]) {
    assert(
      typeof pkg.scripts?.[name] === 'string' && pkg.scripts[name].trim(),
      `missing script: ${name}`,
    );
  }

  assert(/## Unreleased/u.test(changelog), 'changelog must describe the current unreleased state');
  assert(
    /candidate is not published until the gated manual release workflow publishes it/iu.test(
      changelog,
    ),
    'changelog must distinguish the current candidate from hosted releases',
  );
  assert(
    changelog.includes(`Current package candidate: \`${pkg.version}\``),
    'changelog candidate version must match package.json',
  );

  for (const key of [
    'PORT',
    'SERVICE_NAME',
    'THERGRID_PORT',
    'THERGRID_LOG_LEVEL',
    'GITHUB_SHA',
    'RELEASE_TAG',
  ]) {
    assert(new RegExp(`^${key}=`, 'mu').test(envExample), `.env.example must document ${key}`);
  }

  assert(/npm ci --ignore-scripts/u.test(ci), 'CI must use reproducible npm install');
  assert(/npm audit --audit-level=moderate/u.test(ci), 'CI must audit dependencies');
  assert(
    /package-ecosystem:\s*"?npm"?/u.test(dependabot),
    'Dependabot must track npm dependencies',
  );
  assert(
    /package-ecosystem:\s*"?github-actions"?/u.test(dependabot),
    'Dependabot must track GitHub Actions',
  );
  const weeklySchedules = dependabot.match(/interval:\s*"?weekly"?/gu) ?? [];
  assert(weeklySchedules.length >= 2, 'Dependabot must run weekly for npm and GitHub Actions');
  assert(/\n  typecheck:\n/u.test(ci), 'CI must expose a plainly named typecheck job');
  assert(/\n  lint:\n/u.test(ci), 'CI must expose a plainly named lint job');
  assert(/\n  test:\n/u.test(ci), 'CI must expose a plainly named test job');
  assert(/\n  coverage:\n/u.test(ci), 'CI must expose a plainly named coverage job');
  assert(
    /\n  fresh-clone-smoke:\n/u.test(ci),
    'CI must expose a plainly named fresh-clone-smoke job',
  );
  assert(/\n  container-smoke:\n/u.test(ci), 'CI must expose a plainly named container-smoke job');
  assert(/npm run typecheck/u.test(ci), 'CI must type-check maintained JavaScript');
  assert(
    /npm run typecheck:strict-renderer/u.test(ci),
    'CI must strictly type-check the renderer evidence safety boundary',
  );
  assert(
    /Type-check v4 spatial application/u.test(v4Web) && /npm run typecheck/u.test(v4Web),
    'v4 web CI must type-check the spatial application',
  );
  assert(
    /Build v4 spatial application/u.test(v4Web) && /npm run build/u.test(v4Web),
    'v4 web CI must build the spatial application',
  );
  assert(
    /actions\/upload-artifact@v7/u.test(v4Web) &&
      /path:\s*apps\/aethergrid-console\/web\/dist\//u.test(v4Web) &&
      /if-no-files-found:\s*error/u.test(v4Web),
    'v4 web CI must retain a non-empty compiled spatial application artifact',
  );
  assert(/npm test/u.test(ci), 'CI must expose the conventional npm test suite');
  assert(/npm run coverage/u.test(ci), 'CI must enforce coverage');
  assert(
    /NODE_V8_COVERAGE:\s*coverage\/v8/u.test(ci) &&
      /actions\/upload-artifact@v7/u.test(ci) &&
      /path:\s*coverage\/v8\//u.test(ci),
    'CI must retain runtime coverage evidence',
  );
  assert(/npm run demo/u.test(ci), 'CI must run evidence demo');
  assert(/npm run dashboard-demo/u.test(ci), 'CI must run dashboard demo');
  assert(
    /npm run package:aethergrid-app/u.test(ci),
    'CI must build the complete ÆTHERGRID frontend and backend archive',
  );
  assert(
    /npm run package:aethergrid/u.test(ci),
    'CI must build and verify the complete ÆTHERGRID UI archive',
  );
  assert(
    pkg.scripts['operator-console'] === 'node scripts/operator-console.mjs',
    'operator-console script must launch the maintained ÆTHERGRID UI server',
  );
  assert(
    pkg.scripts['package:aethergrid'] === 'node scripts/assemble-aethergrid-package.mjs',
    'package:aethergrid must build the maintained complete ÆTHERGRID ZIP',
  );
  assert(/rm -rf node_modules coverage/u.test(ci), 'fresh-clone CI must remove prior build state');
  assert(
    /docker compose -f docker-compose\.yml build --no-cache/u.test(ci),
    'fresh-clone CI must rebuild the application container without cached layers',
  );
  assert(
    /schedule:/u.test(dependencyFreshness),
    'dependency freshness evidence must run on a schedule',
  );
  assert(
    /npm outdated --json/u.test(dependencyFreshness),
    'dependency freshness workflow must inspect current direct versions',
  );
  assert(
    /actions\/upload-artifact@v7/u.test(dependencyFreshness),
    'dependency freshness workflow must retain machine-readable evidence',
  );
  assert(
    /docker compose -f docker-compose\.yml config --quiet/u.test(ci),
    'CI must validate canonical docker-compose.yml',
  );
  assert(/docker compose up --build/u.test(ci), 'CI must smoke-test the container runtime');
  assert(/pull_request:/u.test(codeql), 'CodeQL must run for pull requests');
  const errorReporting = await text('src/error-reporting.mjs');
  assert(
    /createErrorReporter/u.test(errorReporting) && /onError/u.test(errorReporting),
    'provider-neutral error reporter must remain available',
  );
  assert(/javascript-typescript/u.test(codeql), 'CodeQL must analyze JavaScript/TypeScript');
  assert(/workflow_dispatch:/u.test(release), 'GitHub release workflow must remain manual-only');
  assert(/github\.ref == 'refs\/heads\/main'/u.test(release), 'release workflow must require main');
  assert(
    /npm run check/u.test(release),
    'release workflow must rerun deterministic repository checks',
  );
  assert(
    /Requested tag must equal/u.test(release),
    'release workflow must bind the tag to package version',
  );
  assert(
    /npm sbom --sbom-format=cyclonedx/u.test(release),
    'release workflow must generate a dependency SBOM',
  );
  assert(
    /release-artifacts\.sha256/u.test(release),
    'release workflow must checksum attached evidence',
  );
  assert(
    /release-manifest\.json/u.test(release),
    'release workflow must attach an exact provenance manifest',
  );
  assert(
    /npm run package:aethergrid/u.test(release) &&
      /dist\/aethergrid-operator-console\.zip/u.test(release),
    'release workflow must build and attach the complete ÆTHERGRID UI ZIP',
  );
  assert(
    /RELEASE_TAG/u.test(release) && /GITHUB_SHA/u.test(release),
    'release manifest must bind requested tag and exact commit',
  );
  assert(
    /sha256sum --check release-artifacts\.sha256/u.test(release),
    'release workflow must verify its evidence checksums before publication',
  );
  assert(
    /actions\/upload-artifact@v7/u.test(release),
    'release workflow must retain the verified evidence bundle as a workflow artifact',
  );
  assert(/retention-days: 30/u.test(release), 'release evidence retention must remain explicit');

  assert(
    /node scripts\/create-release-manifest\.mjs/u.test(release),
    'release workflow must use the validated manifest generator',
  );
  assert(
    /node scripts\/create-release-manifest\.mjs/u.test(ci),
    'quality workflow must smoke-test release manifest generation',
  );
  assert(
    /gh release create/u.test(release),
    'release workflow must publish through GitHub Releases',
  );
  assert(
    /## Implemented today/u.test(readme),
    'README must identify currently implemented capability',
  );
  assert(
    /## Target architecture \(not yet the current tree\)/u.test(readme),
    'README must separate target architecture from the current tree',
  );
  assert(
    /simulation before actuation/iu.test(readme),
    'README must preserve simulation-before-actuation rule',
  );
  assert(
    /classical baseline/iu.test(readme),
    'README must preserve the classical-baseline requirement',
  );
  assert(
    /renderer-neutral/iu.test(readme),
    'README must document renderer-neutral spatial evidence',
  );

  const exactAethergridLegacyHtml = await text('apps/aethergrid-console/index.html');
  const exactAethergridServer = await text('apps/aethergrid-console/server.mjs');
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
  assert(
    /dimensions: \['x', 'y', 'z', 'time'\]/u.test(exactAethergridServer) &&
      /const spatialGraph = buildSpatialGraph\(\)/u.test(exactAethergridServer),
    'ÆTHERGRID backend must build a time-indexed spatial graph',
  );
  assert(
    /function agentContext\(input = \{\}\)/u.test(exactAethergridServer) &&
      /function analyzeCityUseCase\(mesh, useCaseId\)/u.test(exactAethergridServer) &&
      /CITY_USE_CASES/u.test(exactAethergridServer) &&
      /externalContext: \{/u.test(exactAethergridServer) &&
      /geospatial: state\.externalContext\.geospatial/u.test(exactAethergridServer) &&
      /quantum: state\.externalContext\.quantum/u.test(exactAethergridServer),
    'ÆTHERGRID agent requests must receive bounded geospatial and quantum runtime context',
  );
  const aethergridAgentConfig = await text('apps/aethergrid-console/agent-config.mjs');
  const aethergridAiRuntime = await text('apps/aethergrid-console/ai-runtime.mjs');
  const aethergridProfileStore = await text('apps/aethergrid-console/profile-store.mjs');
  const aethergridGeoRuntime = await text('apps/aethergrid-console/geo-runtime.mjs');
  const aethergridEnvironmentRuntime = await text(
    'apps/aethergrid-console/city-environment-runtime.mjs',
  );
  const aethergridLiveRuntime = await text('apps/aethergrid-console/city-live-runtime.mjs');
  const aethergridTerrainRuntime = await text('apps/aethergrid-console/terrain-runtime.mjs');
  const aethergridQuantumRuntime = await text('apps/aethergrid-console/quantum-runtime.mjs');
  assert(
    /openai-compatible/u.test(aethergridAgentConfig) &&
      /ollama/u.test(aethergridAgentConfig) &&
      /local/u.test(aethergridAgentConfig) &&
      /AETHERGRID_VAELON/u.test(aethergridAgentConfig) &&
      /AETHERGRID_AUREN/u.test(aethergridAgentConfig) &&
      /AETHERGRID_SOLVAER/u.test(aethergridAgentConfig),
    'ÆTHERGRID agent configuration must preserve replaceable provider and per-agent model wiring',
  );
  assert(
    /async function callOpenAiCompatible/u.test(aethergridAiRuntime) &&
      /async function callOllama/u.test(aethergridAiRuntime) &&
      /async function runTeam/u.test(aethergridAiRuntime) &&
      /Promise\.all/u.test(aethergridAiRuntime) &&
      /fallbackUsed/u.test(aethergridAiRuntime),
    'ÆTHERGRID AI runtime must keep real provider adapters, team orchestration, and fallback evidence',
  );
  assert(
    /operator-profile\.json/u.test(aethergridProfileStore) &&
      /avatarDataUrl/u.test(aethergridProfileStore) &&
      /mode: 0o600/u.test(aethergridProfileStore),
    'ÆTHERGRID profile store must persist bounded local profile data with private file mode',
  );
  assert(
    /OpenStreetMap Overpass/u.test(aethergridGeoRuntime) &&
      /© OpenStreetMap contributors/u.test(aethergridGeoRuntime) &&
      /nwr\["building"\]/u.test(aethergridGeoRuntime) &&
      /nwr\["building:part"\]/u.test(aethergridGeoRuntime) &&
      /heightProfile/u.test(aethergridGeoRuntime) &&
      /numericRoofHeight/u.test(aethergridGeoRuntime) &&
      /buildingGeometries/u.test(aethergridGeoRuntime) &&
      /representativeBuildings/u.test(aethergridGeoRuntime) &&
      /skylineProfile/u.test(aethergridGeoRuntime) &&
      /namedStructures/u.test(aethergridGeoRuntime) &&
      /namedStructureCount/u.test(aethergridGeoRuntime) &&
      /tallStructureCount/u.test(aethergridGeoRuntime) &&
      /timestamp_osm_base/u.test(aethergridGeoRuntime) &&
      /way\["highway"\]/u.test(aethergridGeoRuntime) &&
      /way\["power"~"\^\(line\|minor_line\|cable\)\$"\]/u.test(aethergridGeoRuntime) &&
      /substation\|plant\|generator\|transformer/u.test(aethergridGeoRuntime) &&
      /parseOverpassRoads/u.test(aethergridGeoRuntime) &&
      /parseOverpassWater/u.test(aethergridGeoRuntime) &&
      /parseOverpassGreen/u.test(aethergridGeoRuntime) &&
      /natural"="water/u.test(aethergridGeoRuntime) &&
      /natural"="coastline/u.test(aethergridGeoRuntime) &&
      /greenAreas/u.test(aethergridGeoRuntime) &&
      /parseOverpassPower/u.test(aethergridGeoRuntime) &&
      /async function pointMesh/u.test(aethergridGeoRuntime) &&
      /supportsCustomCoordinates: true/u.test(aethergridGeoRuntime) &&
      /cache/u.test(aethergridGeoRuntime),
    'ÆTHERGRID geospatial runtime must keep on-demand OpenStreetMap building, road, water, green-space and power-grid geometry with arbitrary coordinate support',
  );
  assert(
    /api\.open-meteo\.com\/v1\/forecast/u.test(aethergridEnvironmentRuntime) &&
      /temperature_2m/u.test(aethergridEnvironmentRuntime) &&
      /cloud_cover/u.test(aethergridEnvironmentRuntime) &&
      /is_day/u.test(aethergridEnvironmentRuntime) &&
      /wind_speed_10m/u.test(aethergridEnvironmentRuntime) &&
      /relative_humidity_2m/u.test(aethergridEnvironmentRuntime) &&
      /surface_pressure/u.test(aethergridEnvironmentRuntime) &&
      /sunrise/u.test(aethergridEnvironmentRuntime) &&
      /sunset/u.test(aethergridEnvironmentRuntime) &&
      /daylight_duration/u.test(aethergridEnvironmentRuntime) &&
      /sunshine_duration/u.test(aethergridEnvironmentRuntime) &&
      /local-environment-fallback/u.test(aethergridEnvironmentRuntime) &&
      /credentialsExposed: false/u.test(aethergridEnvironmentRuntime),
    'ÆTHERGRID city environment runtime must keep current open weather context with explicit fallback',
  );
  assert(
    /air-quality-api\.open-meteo\.com\/v1\/air-quality/u.test(aethergridLiveRuntime) &&
      /earthquake\.usgs\.gov\/earthquakes\/feed\/v1\.0\/summary\/2\.5_day\.geojson/u.test(
        aethergridLiveRuntime,
      ) &&
      /us_aqi/u.test(aethergridLiveRuntime) &&
      /pm2_5/u.test(aethergridLiveRuntime) &&
      /haversineKm/u.test(aethergridLiveRuntime) &&
      /localOffsetMeters/u.test(aethergridLiveRuntime) &&
      /citySnapshot/u.test(aethergridLiveRuntime) &&
      /globalSnapshot/u.test(aethergridLiveRuntime) &&
      /local-air-quality-fallback/u.test(aethergridLiveRuntime) &&
      /local-seismic-fallback/u.test(aethergridLiveRuntime) &&
      /credentialsExposed: false/u.test(aethergridLiveRuntime),
    'ÆTHERGRID live city runtime must keep attributed air-quality and USGS seismic adapters with explicit fallback',
  );
  assert(
    /api\.open-meteo\.com\/v1\/elevation/u.test(aethergridTerrainRuntime) &&
      /Copernicus DEM GLO-90/u.test(aethergridTerrainRuntime) &&
      /interpolateTerrainRelativeElevation/u.test(aethergridTerrainRuntime) &&
      /bilinear-local-grid/u.test(aethergridTerrainRuntime) &&
      /maxPointsPerRequest: provider === 'open-meteo' \? 100/u.test(aethergridTerrainRuntime) &&
      /flat-local-fallback/u.test(aethergridTerrainRuntime) &&
      /credentialsExposed: false/u.test(aethergridTerrainRuntime),
    'ÆTHERGRID terrain runtime must keep live elevation sampling, attribution, bounded requests and explicit fallback',
  );
  assert(
    /Open-Meteo Elevation/u.test(aethergridTerrainRuntime) &&
      /Copernicus DEM GLO-90/u.test(aethergridTerrainRuntime) &&
      /flat-local-fallback/u.test(aethergridTerrainRuntime) &&
      /credentialsExposed: false/u.test(aethergridTerrainRuntime) &&
      /gridSize/u.test(aethergridTerrainRuntime),
    'ÆTHERGRID terrain runtime must keep attributed elevation sampling and explicit flat fallback',
  );
  assert(
    /2026-04-15/u.test(aethergridQuantumRuntime) &&
      /iam\.cloud\.ibm\.com/u.test(aethergridQuantumRuntime) &&
      /program_id: 'sampler'/u.test(aethergridQuantumRuntime) &&
      /hardwareSubmitted/u.test(aethergridQuantumRuntime) &&
      /jobs\/\$\{encodeURIComponent\(id\)\}\/results/u.test(aethergridQuantumRuntime) &&
      /jobs\/\$\{encodeURIComponent\(id\)\}\/metrics/u.test(aethergridQuantumRuntime) &&
      /local-simulator/u.test(aethergridQuantumRuntime),
    'ÆTHERGRID quantum runtime must keep IBM Compute Service submission and local fallback',
  );
  assert(
    /legacy\/standalone\.html/u.test(exactAethergridPackager) &&
      /legacy\/index\.html/u.test(exactAethergridPackager) &&
      /canonicalWebApp: 'web\/dist\/index\.html'/u.test(exactAethergridPackager) &&
      /cesium-primary-spatial-renderer/u.test(exactAethergridPackager) &&
      /legacy-native-webgl-compatibility/u.test(exactAethergridPackager) &&
      /node_modules\/zod/u.test(exactAethergridPackager) &&
      /START-AETHERGRID\.ps1/u.test(exactAethergridPackager) &&
      /STOP-AETHERGRID\.ps1/u.test(exactAethergridPackager) &&
      /START-AETHERGRID\.cmd/u.test(exactAethergridPackager) &&
      !/^\s*'assets\/dashboard-reference\.webp',/mu.test(exactAethergridPackager),
    'ÆTHERGRID packager must ship the canonical React/Cesium runtime plus explicitly noncanonical native compatibility',
  );

  // ÆTHERGRID v4.0 Provider Architecture Verification
  const envSchema = await text('apps/aethergrid-console/config/env-schema.mjs');
  const providerConfig = await text('apps/aethergrid-console/config/provider-config.mjs');
  const secretRedactor = await text('apps/aethergrid-console/security/secret-redactor.mjs');
  const urlPolicy = await text('apps/aethergrid-console/security/url-policy.mjs');
  const providerRegistry = await text('apps/aethergrid-console/providers/provider-registry.mjs');

  assert(
    /export const envSchema/u.test(envSchema) &&
      /parseEnv/u.test(envSchema) &&
      /AETHERGRID_PORT/u.test(envSchema) &&
      /AETHERGRID_CESIUM_ION_TOKEN/u.test(envSchema),
    'ÆTHERGRID env schema must define validated Zod schema with forward-compatible keys',
  );

  assert(
    /createProviderConfig/u.test(providerConfig) && /futureProviders/u.test(providerConfig),
    'ÆTHERGRID provider config must assemble frozen server configuration',
  );

  assert(
    /createSecretRedactor/u.test(secretRedactor) &&
      /redactString/u.test(secretRedactor) &&
      /redactValue/u.test(secretRedactor),
    'ÆTHERGRID secret redactor must provide string and object credential redaction',
  );

  assert(
    /createUrlPolicy/u.test(urlPolicy) &&
      /isAllowedUrl/u.test(urlPolicy) &&
      /validateUrl/u.test(urlPolicy),
    'ÆTHERGRID URL policy must validate outbound provider endpoints',
  );

  assert(
    /createProviderRegistry/u.test(providerRegistry) &&
      /getSafePublicRuntimeMetadata/u.test(providerRegistry) &&
      /getProvidersByCapability/u.test(providerRegistry),
    'ÆTHERGRID provider registry must expose queryable capabilities and safe metadata',
  );

  const aethergridStartScript = await text('apps/aethergrid-console/START-AETHERGRID.ps1');
  const aethergridAppEnv = await text('apps/aethergrid-console/.env.example');
  assert(
    /Node\.js 22\+/u.test(aethergridStartScript) &&
      /--env-file=\.env/u.test(aethergridStartScript) &&
      /server\.mjs/u.test(aethergridStartScript),
    'ÆTHERGRID Windows launcher must verify Node 22 and launch the packaged backend',
  );
  assert(
    /AETHERGRID_AI_PROVIDER=local/u.test(aethergridAppEnv) &&
      /AETHERGRID_OPENAI_API_KEY=/u.test(aethergridAppEnv) &&
      /AETHERGRID_OLLAMA_BASE_URL=/u.test(aethergridAppEnv) &&
      /AETHERGRID_GEO_PROVIDER=osm-overpass/u.test(aethergridAppEnv) &&
      /AETHERGRID_OVERPASS_URL=/u.test(aethergridAppEnv) &&
      /AETHERGRID_ENVIRONMENT_PROVIDER=open-meteo/u.test(aethergridAppEnv) &&
      /AETHERGRID_OPEN_METEO_URL=/u.test(aethergridAppEnv) &&
      /AETHERGRID_AIR_QUALITY_PROVIDER=open-meteo/u.test(aethergridAppEnv) &&
      /AETHERGRID_AIR_QUALITY_URL=/u.test(aethergridAppEnv) &&
      /AETHERGRID_SEISMIC_PROVIDER=usgs/u.test(aethergridAppEnv) &&
      /AETHERGRID_USGS_EARTHQUAKE_URL=/u.test(aethergridAppEnv) &&
      /AETHERGRID_TERRAIN_PROVIDER=open-meteo/u.test(aethergridAppEnv) &&
      /AETHERGRID_ELEVATION_URL=/u.test(aethergridAppEnv) &&
      /AETHERGRID_QUANTUM_PROVIDER=local-simulator/u.test(aethergridAppEnv) &&
      /AETHERGRID_IBM_QUANTUM_API_KEY=/u.test(aethergridAppEnv) &&
      /AETHERGRID_IBM_QUANTUM_SERVICE_CRN=/u.test(aethergridAppEnv),
    'ÆTHERGRID package config must document AI, geospatial and quantum providers without embedding credentials',
  );

  const operatorConsole = await text('apps/operator-console/index.html');
  const operatorConsoleStyles = await text('apps/operator-console/styles.css');
  assert(
    /href="\.\/styles\.css"/u.test(operatorConsole) &&
      /src="\.\/app\.js"/u.test(operatorConsole) &&
      /\.\/assets\/brand\/aethergrid-logo-transparent\.webp/u.test(operatorConsole) &&
      /\.\/assets\/reference\/nyc-grid\.svg/u.test(operatorConsoleStyles),
    'operator console must keep direct-file-compatible relative assets',
  );
  assert(
    !/href="\/styles\.css"/u.test(operatorConsole) && !/src="\/app\.js"/u.test(operatorConsole),
    'operator console must not regress to root-relative HTML dependencies',
  );
  const operatorAppManifest = JSON.parse(await text('apps/operator-console/app.json'));
  const operatorUiManifest = JSON.parse(await text('apps/operator-console/ui.json'));
  const modelLogos = await text('apps/operator-console/model-logos.js');

  assert(
    operatorAppManifest.product === 'ÆTHERGRID' &&
      operatorAppManifest.version === pkg.version &&
      operatorAppManifest.entrypoints?.html === 'index.html' &&
      operatorAppManifest.machineReadableUi === 'ui.json',
    'ÆTHERGRID app.json must remain complete and version-aligned',
  );
  assert(
    operatorAppManifest.packageContract?.includesHtmlUi === true &&
      operatorAppManifest.packageContract?.includesJsonUi === true &&
      operatorAppManifest.packageContract?.requiresNonEmptyFiles === true,
    'ÆTHERGRID app.json must require complete HTML/JSON package content',
  );
  assert(
    JSON.stringify(operatorUiManifest.navigation?.map((item) => item.label)) ===
      JSON.stringify(['GRID', 'HOLOGRAPHIC', 'QUANTUM', 'AI', 'EVIDENCE']),
    'ÆTHERGRID ui.json must describe all five maintained operator surfaces',
  );
  assert(
    /\/assets\/brand\/aethergrid-logo-transparent\.webp/u.test(operatorConsole),
    'operator console must render the canonical ÆTHERGRID product logo',
  );
  for (const [model, asset] of [
    ['VÆLON', 'vaelon.webp'],
    ['AUREN', 'auren.webp'],
    ['SOLVÆR', 'solvaer.webp'],
  ]) {
    assert(modelLogos.includes(model), `operator console model map must include ${model}`);
    assert(
      modelLogos.includes(`/assets/brand/agents/${asset}`),
      `operator console model map must use the canonical ${model} brand asset`,
    );
  }

  process.stdout.write(
    `THERGRID release readiness verified for v${pkg.version}: reproducible quality, security, container, evidence, and safety gates are present\n`,
  );
}

await main();
