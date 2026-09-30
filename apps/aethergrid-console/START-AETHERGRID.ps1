$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 22+ is required. Install Node.js, then run this launcher again." -ForegroundColor Red
  exit 1
}

$Version = (& node --version).TrimStart("v").Split(".")
if ([int]$Version[0] -lt 22) {
  Write-Host "ÆTHERGRID requires Node.js 22+. Current version: $(& node --version)" -ForegroundColor Red
  exit 1
}

$Port = 8090
if (Test-Path ".env") {
  $PortLine = Get-Content ".env" | Where-Object { $_ -match '^AETHERGRID_PORT=' } | Select-Object -First 1
  if ($PortLine) { $Port = [int]($PortLine.Split("=")[1]) }
  $Args = @("--env-file=.env", "server.mjs")
} else {
  $Args = @("server.mjs")
}

if (Test-Path ".aethergrid.pid") {
  $ExistingPid = Get-Content ".aethergrid.pid" -ErrorAction SilentlyContinue
  if ($ExistingPid -and (Get-Process -Id $ExistingPid -ErrorAction SilentlyContinue)) {
    Write-Host "ÆTHERGRID is already running (PID $ExistingPid)." -ForegroundColor Yellow
    Start-Process "http://127.0.0.1:$Port"
    exit 0
  }
}

$Process = Start-Process -FilePath "node" -ArgumentList $Args -WorkingDirectory $Root -PassThru
$Process.Id | Set-Content ".aethergrid.pid"
Start-Sleep -Milliseconds 750
Start-Process "http://127.0.0.1:$Port"
Write-Host "ÆTHERGRID started at http://127.0.0.1:$Port (PID $($Process.Id))." -ForegroundColor Cyan
Write-Host "Run STOP-AETHERGRID.ps1 to stop the local server."
