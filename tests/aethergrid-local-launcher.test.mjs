import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const launcherPath = new URL('../apps/aethergrid-console/START-AETHERGRID.ps1', import.meta.url);
const commandPath = new URL('../apps/aethergrid-console/START-AETHERGRID.cmd', import.meta.url);

test('Windows launcher preserves unprivileged double-click startup and Node 22 compatibility', async () => {
  const [launcher, command] = await Promise.all([
    readFile(launcherPath, 'utf8'),
    readFile(commandPath, 'utf8'),
  ]);
  assert.match(command, /powershell -NoProfile -ExecutionPolicy Bypass -File/u);
  assert.match(command, /START-AETHERGRID\.ps1/u);
  assert.match(launcher, /Get-Command node/u);
  assert.match(launcher, /Get-FileHash -Path \$TempArchive -Algorithm SHA256/u);
  assert.match(launcher, /nodejs\.org\/dist\/v\$Version\/\$ArchiveName/u);
  assert.match(launcher, /\.aethergrid-runtime/u);
  assert.match(launcher, /Copy-Item -Path \$ExtractedNode -Destination \$PortableNode/u);
  assert.match(launcher, /\$NodeMajor -ne 22/u);
  assert.match(launcher, /Start-Process -FilePath \$NodeCommand\.Source/u);
  assert.doesNotMatch(launcher, /RunAs|Start-Process[^\n]*-Verb/u);
});

test('launcher resolves browser port using the same env-file ordering as Node and rejects unsafe ports', async () => {
  const launcher = await readFile(launcherPath, 'utf8');
  assert.match(launcher, /foreach \(\$FileName in @\("\.env", "\.env\.aethergrid"\)\)/u);
  assert.match(launcher, /\$env:AETHERGRID_PORT/u);
  assert.match(launcher, /int\]::TryParse/u);
  assert.match(launcher, /\$Resolved -lt 1/u);
  assert.match(launcher, /\$Resolved -gt 65535/u);
  assert.match(launcher, /\$Arguments \+= "--env-file=\.env"/u);
  assert.match(launcher, /\$Arguments \+= "--env-file=\.env\.aethergrid"/u);
  assert.match(launcher, /\$HealthUrl = "\$Url\/api\/aethergrid\/health"/u);
});

test('launcher cannot report startup success without verified ÆTHERGRID health and a live child process', async () => {
  const launcher = await readFile(launcherPath, 'utf8');
  assert.match(launcher, /Invoke-RestMethod -Uri \$HealthUrl/u);
  assert.match(launcher, /\$ProductName = \(\[char\]0x00C6\) \+ "THERGRID"/u);
  assert.match(launcher, /\$Health\.ok -eq \$true -and \$Health\.product -eq "\$ProductName"/u);
  assert.match(launcher, /\$ExistingProcess\.ProcessName -eq "node"/u);
  assert.match(launcher, /\$Process\.HasExited/u);
  assert.match(launcher, /if \(-not \$Ready\)/u);
  assert.match(launcher, /Remove-Item \$PidPath -Force/u);
  assert.match(launcher, /if \(Test-AethergridReady\)/u);
  assert.match(launcher, /\$ProductName ready at/u);
  assert.doesNotMatch(launcher, /Start-Sleep -Milliseconds 750/u);
});


test('startup requires actual provider credentials and never embeds CI secrets in the app', async () => {
  const [launcher, packager] = await Promise.all([
    readFile(launcherPath, 'utf8'),
    readFile(new URL('../scripts/assemble-aethergrid-full-app.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(launcher, /--env-file=\.env\.secrets/u);
  assert.match(packager, /\.env\.secrets\.example/u);
  assert.match(packager, /\.aethergrid-runtime/u);
  assert.doesNotMatch(launcher, /gsk_[A-Za-z0-9]{15}/u);
});
