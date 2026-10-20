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
  assert.match(launcher, /\$Health\.ok -eq \$true -and \$Health\.product -eq "ÆTHERGRID"/u);
  assert.match(launcher, /\$ExistingProcess\.ProcessName -eq "node"/u);
  assert.match(launcher, /\$Process\.HasExited/u);
  assert.match(launcher, /if \(-not \$Ready\)/u);
  assert.match(launcher, /Remove-Item \$PidPath -Force/u);
  assert.match(launcher, /if \(Test-AethergridReady\)/u);
  assert.match(launcher, /ÆTHERGRID ready at/u);
  assert.doesNotMatch(launcher, /Start-Sleep -Milliseconds 750/u);
});
