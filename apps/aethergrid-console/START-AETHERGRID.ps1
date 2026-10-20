$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCommand) {
  Write-Host "Node.js 22 is required for the live ÆTHERGRID services. The root index.html can still open without Node." -ForegroundColor Red
  exit 1
}

$NodeVersion = (& $NodeCommand.Source --version).TrimStart("v")
$NodeMajor = 0
if (-not [int]::TryParse(($NodeVersion -split "\.")[0], [ref]$NodeMajor) -or $NodeMajor -ne 22) {
  Write-Host "ÆTHERGRID requires Node.js 22. Current version: v$NodeVersion" -ForegroundColor Red
  exit 1
}

# Node loads the later env file last, but inherited process variables take precedence.
# Resolve the same effective port before opening the browser.
function Get-ConfiguredPort {
  $Value = "8090"
  foreach ($FileName in @(".env", ".env.aethergrid")) {
    $FilePath = Join-Path $Root $FileName
    if (-not (Test-Path $FilePath)) { continue }
    foreach ($Line in (Get-Content $FilePath)) {
      if ($Line -match '^\s*AETHERGRID_PORT\s*=\s*(.*?)\s*(?:#.*)?$') {
        $Value = $Matches[1].Trim().Trim([char[]]@('"', "'"))
      }
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($env:AETHERGRID_PORT)) {
    $Value = $env:AETHERGRID_PORT.Trim()
  }
  $Resolved = 0
  if (-not [int]::TryParse($Value, [ref]$Resolved) -or $Resolved -lt 1 -or $Resolved -gt 65535) {
    throw "Invalid AETHERGRID_PORT. Use an integer between 1 and 65535."
  }
  return $Resolved
}

try {
  $Port = Get-ConfiguredPort
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}

$Url = "http://127.0.0.1:$Port"
$HealthUrl = "$Url/api/aethergrid/health"
function Test-AethergridReady {
  try {
    $Health = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 2
    return $Health.ok -eq $true -and $Health.product -eq "ÆTHERGRID"
  } catch {
    return $false
  }
}

$PidPath = Join-Path $Root ".aethergrid.pid"
if (Test-Path $PidPath) {
  $PreviousPid = 0
  $SavedPid = (Get-Content $PidPath -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ([int]::TryParse([string]$SavedPid, [ref]$PreviousPid) -and $PreviousPid -gt 0) {
    $ExistingProcess = Get-Process -Id $PreviousPid -ErrorAction SilentlyContinue
    if ($ExistingProcess -and $ExistingProcess.ProcessName -eq "node") {
      if (Test-AethergridReady) {
        Write-Host "ÆTHERGRID is already running (PID $PreviousPid)." -ForegroundColor Yellow
        if ($env:AETHERGRID_NO_BROWSER -ne "1") { Start-Process $Url }
        exit 0
      }
      Write-Host "A previous Node process (PID $PreviousPid) exists, but ÆTHERGRID did not answer on port $Port. No duplicate server launched." -ForegroundColor Red
      exit 1
    }
  }
  Remove-Item $PidPath -Force -ErrorAction SilentlyContinue
}

$Arguments = @()
if (Test-Path (Join-Path $Root ".env")) {
  $Arguments += "--env-file=.env"
}
if (Test-Path (Join-Path $Root ".env.aethergrid")) {
  $Arguments += "--env-file=.env.aethergrid"
}
$Arguments += "server.mjs"

try {
  $Process = Start-Process -FilePath $NodeCommand.Source -ArgumentList $Arguments -WorkingDirectory $Root -PassThru
  $Process.Id | Set-Content $PidPath
  $Ready = $false
  for ($Attempt = 0; $Attempt -lt 30; $Attempt++) {
    $Process.Refresh()
    if ($Process.HasExited) { break }
    if (Test-AethergridReady) {
      $Ready = $true
      break
    }
    Start-Sleep -Milliseconds 350
  }
  if (-not $Ready) {
    Remove-Item $PidPath -Force -ErrorAction SilentlyContinue
    Write-Host "ÆTHERGRID did not become ready on $HealthUrl. The server may have failed or the port may be occupied." -ForegroundColor Red
    exit 1
  }
  if ($env:AETHERGRID_NO_BROWSER -ne "1") { Start-Process $Url }
  Write-Host "ÆTHERGRID ready at $Url (PID $($Process.Id))." -ForegroundColor Cyan
  Write-Host "Run STOP-AETHERGRID.ps1 to stop the local server."
} catch {
  Remove-Item $PidPath -Force -ErrorAction SilentlyContinue
  Write-Host "ÆTHERGRID startup failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
