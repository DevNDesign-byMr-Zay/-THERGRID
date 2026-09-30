$ErrorActionPreference = "SilentlyContinue"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Test-Path ".aethergrid.pid")) {
  Write-Host "No ÆTHERGRID PID file was found." -ForegroundColor Yellow
  exit 0
}

$PidValue = Get-Content ".aethergrid.pid"
$Process = Get-Process -Id $PidValue -ErrorAction SilentlyContinue
if ($Process) {
  Stop-Process -Id $PidValue -Force
  Write-Host "ÆTHERGRID stopped (PID $PidValue)." -ForegroundColor Cyan
}
Remove-Item ".aethergrid.pid" -Force -ErrorAction SilentlyContinue
