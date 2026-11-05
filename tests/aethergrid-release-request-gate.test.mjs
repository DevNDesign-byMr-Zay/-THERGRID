import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const sha = 'a'.repeat(40);
const read = (path) => readFile(new URL(path, root), 'utf8');
function shellStep(workflow, name) {
  const section = workflow.split(`      - name: ${name}\n`)[1]?.split('\n      - name: ')[0];
  assert.ok(section, `missing executable step: ${name}`);
  return (
    section
      .split('        run: |\n')[1]
      ?.split('\n')
      .map((line) => line.slice(10))
      .join('\n') ?? section.split('        run: ')[1]?.trim()
  );
}

async function execute(script, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'aethergrid-release-gate-'));
  try {
    await mkdir(join(dir, 'docs/releases'), { recursive: true });
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ version: options.version ?? '0.3.5' }),
    );
    for (const version of ['0.3.2', '0.3.3', '0.3.4', '0.3.5']) {
      await writeFile(
        join(dir, `docs/releases/v${version}.request`),
        options.intent ?? `v${version}\n`,
      );
    }
    if (options.notes)
      await writeFile(
        join(dir, `docs/releases/${options.tag ?? 'v0.3.5'}.md`),
        'Software quantum scope',
      );
    // Run the workflow's actual Bash; shell functions isolate only external commands.
    // Forward slashes also let Git Bash consume Windows Node and temporary paths.
    const executable = process.execPath.replaceAll('\\', '/').replaceAll("'", "'\\''");
    const commands = `
      node() { command '${executable}' "$@"; }
      git() {
        if [ "$1" = ls-remote ]; then printf '%s\\trefs/heads/main\\n' "$REMOTE_SHA";
        elif [ "$2" = HEAD ]; then echo "$LOCAL_SHA";
        else return "$TAG_EXISTS"; fi
      }
      gh() {
        printf '%s\\n' "$*" >> "$GH_LOG"
        if [ "$1 $2" = 'release view' ]; then return "$PUBLISHED"; fi
      }
    `;
    const result = spawnSync('bash', ['-c', commands + script], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        VERIFIED_SHA: sha,
        GITHUB_SHA: sha,
        LOCAL_SHA: options.localSha ?? sha,
        REMOTE_SHA: options.remoteSha ?? sha,
        PUBLISHED: options.published ? '0' : '1',
        TAG_EXISTS: options.tagExists ? '0' : '1',
        REQUESTED_TAG: options.tag ?? 'v0.3.5',
        RELEASE_TAG: options.tag ?? 'v0.3.5',
        GITHUB_OUTPUT: join(dir, 'output').replaceAll('\\', '/'),
        GH_LOG: join(dir, 'gh.log').replaceAll('\\', '/'),
      },
    });
    const output = await readFile(join(dir, 'output').replaceAll('\\', '/'), 'utf8').catch(
      () => '',
    );
    const calls = await readFile(join(dir, 'gh.log').replaceAll('\\', '/'), 'utf8').catch(() => '');
    return { ...result, output, calls };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

for (const version of ['0.3.2', '0.3.3', '0.3.4', '0.3.5']) {
  test(`v${version} bridge retires safely for a later package candidate`, async () => {
    const workflow = await read(`.github/workflows/release-request-v${version}.yml`);
    const result = await execute(
      shellStep(workflow, 'Verify release intent, commit, version and publication state'),
      { version: '0.3.6' },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'publish=false\n');
    assert.equal(result.calls, '');
  });
}

for (const [name, options] of Object.entries({
  'wrong checkout SHA': { localSha: 'b'.repeat(40) },
  'superseded main': { remoteSha: 'b'.repeat(40) },
  'wrong release intent': { intent: 'v0.0.0' },
})) {
  test(`v0.3.5 bridge refuses ${name} without publication`, async () => {
    const workflow = await read('.github/workflows/release-request-v0.3.5.yml');
    const result = await execute(
      shellStep(workflow, 'Verify release intent, commit, version and publication state'),
      options,
    );
    assert.notEqual(result.status, 0);
    assert.equal(result.output, '');
    assert.equal(result.calls, '');
  });
}

for (const published of [false, true]) {
  test(`v0.3.5 bridge ${published ? 'skips an already published release' : 'dispatches the existing protected workflow'}`, async () => {
    const workflow = await read('.github/workflows/release-request-v0.3.5.yml');
    assert.match(workflow, /if: steps\.candidate\.outputs\.publish == 'true'/);
    const gate = shellStep(
      workflow,
      'Verify release intent, commit, version and publication state',
    );
    const dispatch = shellStep(
      workflow,
      'Dispatch the existing protected, manual-only publication workflow',
    );
    const result = await execute(
      `${gate}\nif grep -qx 'publish=true' "$GITHUB_OUTPUT"; then\n${dispatch}\nfi`,
      { published },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, `publish=${!published}\n`);
    assert.equal(
      result.calls.includes('workflow run release.yml --ref main --field tag=v0.3.5'),
      !published,
    );
  });
}

for (const [name, options] of Object.entries({
  'wrong tag version': { tag: 'v0.3.4' },
  'already existing tag': { tagExists: true },
})) {
  test(`publication rejects ${name}`, async () => {
    const workflow = await read('.github/workflows/release.yml');
    const result = await execute(
      shellStep(workflow, 'Normalize and validate requested tag'),
      options,
    );
    assert.notEqual(result.status, 0);
    assert.equal(result.output, '');
  });
}

for (const name of ['Refuse superseded release main', 'Recheck release main before publication']) {
  test(`${name} executes exact-main refusal`, async () => {
    const workflow = await read('.github/workflows/release.yml');
    assert.equal((await execute(shellStep(workflow, name))).status, 0);
    assert.notEqual(
      (await execute(shellStep(workflow, name), { remoteSha: 'b'.repeat(40) })).status,
      0,
    );
  });
}

test('real Aer PR coverage includes both candidate manifests', async () => {
  const workflow = await read('.github/workflows/aethergrid-qiskit-aer.yml');
  assert.match(workflow, /^      - "package\.json"$/m);
  assert.match(workflow, /^      - "package-lock\.json"$/m);
});

for (const [tag, notes] of [
  ['v0.3.5', true],
  ['v0.3.5', false],
  ['v0.3.6', true],
]) {
  test(`publication includes generated notes and optional matching ${tag} notes: ${notes}`, async () => {
    const workflow = await read('.github/workflows/release.yml');
    const result = await execute(shellStep(workflow, 'Publish GitHub release'), { tag, notes });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.calls.includes(`release create ${tag}`));
    assert.ok(result.calls.includes('--generate-notes'));
    assert.equal(result.calls.includes(`--notes-file docs/releases/${tag}.md`), notes);
    assert.ok(result.calls.includes(`--target ${sha}`));
  });
}
