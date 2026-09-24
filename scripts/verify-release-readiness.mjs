import { access, readFile } from 'node:fs/promises';

const REQUIRED_FILES = Object.freeze([
  'Dockerfile',
  'compose.yml',
  'package-lock.json',
  'CHANGELOG.md',
  'README.md',
  'docs/ARCHITECTURE.md',
  'docs/ROADMAP.md',
  '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/release.yml',
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

  const [pkg, changelog, readme, ci, codeql, release] = await Promise.all([
    text('package.json').then(JSON.parse),
    text('CHANGELOG.md'),
    text('README.md'),
    text('.github/workflows/ci.yml'),
    text('.github/workflows/codeql.yml'),
    text('.github/workflows/release.yml'),
  ]);

  assert(/^\d+\.\d+\.\d+$/u.test(pkg.version), 'package version must be semantic');
  assert(pkg.private === true, 'THERGRID package must remain private');
  assert(pkg.type === 'module', 'THERGRID must remain ESM');
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
    /No hosted GitHub release or tag is claimed/iu.test(changelog),
    'changelog must not fabricate a published release',
  );
  assert(
    changelog.includes(`Current package candidate: \`${pkg.version}\``),
    'changelog candidate version must match package.json',
  );

  assert(/npm ci --ignore-scripts/u.test(ci), 'CI must use reproducible npm install');
  assert(/npm audit --audit-level=moderate/u.test(ci), 'CI must audit dependencies');
  assert(/npm run coverage/u.test(ci), 'CI must enforce coverage');
  assert(/npm run demo/u.test(ci), 'CI must run evidence demo');
  assert(/npm run dashboard-demo/u.test(ci), 'CI must run dashboard demo');
  assert(/docker compose up --build/u.test(ci), 'CI must smoke-test the container runtime');
  assert(/pull_request:/u.test(codeql), 'CodeQL must run for pull requests');
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
