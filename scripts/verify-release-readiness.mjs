import { access, readFile } from 'node:fs/promises';

const REQUIRED_FILES = Object.freeze([
  'Dockerfile',
  'compose.yml',
  'docker-compose.yml',
  '.env.example',
  'package-lock.json',
  'jsconfig.json',
  '.repo-class.json',
  'docs/PROJECT_SCOPE.md',
  'src/error-reporting.mjs',
  'CHANGELOG.md',
  'README.md',
  'docs/ARCHITECTURE.md',
  'docs/ROADMAP.md',
  'docs/RELEASE_READINESS.md',
  '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/release.yml',
  '.github/dependabot.yml',
  'SECURITY.md',
  'CONTRIBUTING.md',
  '.github/CODEOWNERS',
  '.github/pull_request_template.md',
  'scripts/create-release-manifest.mjs',
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
    codeql,
    release,
    envExample,
    dependabot,
    classification,
    projectScope,
  ] = await Promise.all([
    text('package.json').then(JSON.parse),
    text('CHANGELOG.md'),
    text('README.md'),
    text('.github/workflows/ci.yml'),
    text('.github/workflows/codeql.yml'),
    text('.github/workflows/release.yml'),
    text('.env.example'),
    text('.github/dependabot.yml'),
    text('.repo-class.json').then(JSON.parse),
    text('docs/PROJECT_SCOPE.md'),
  ]);

  assert(/^\d+\.\d+\.\d+$/u.test(pkg.version), 'package version must be semantic');
  assert(pkg.private === true, 'THERGRID package must remain private');
  assert(pkg.type === 'module', 'THERGRID must remain ESM');
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

  for (const name of [
    'coverage',
    'syntax',
    'demo',
    'dashboard-demo',
    'lint',
    'typecheck',
    'format:check',
    'check',
    'verify:release',
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
  assert(/npm run typecheck/u.test(ci), 'CI must type-check maintained JavaScript');
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

  process.stdout.write(
    `THERGRID release readiness verified for v${pkg.version}: reproducible quality, security, container, evidence, and safety gates are present\n`,
  );
}

await main();
