$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
# PowerShell 5.1 can misdecode UTF-8 scripts without a BOM; assemble the brand name safely.
$ProductName = ([char]0x00C6) + "THERGRID"

# Use an existing Node 22 runtime, or bootstrap the official portable binary
# into this extracted app folder without administrator rights.
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
$LocalRuntime = Join-Path $Root ".aethergrid-runtime"
$PortableNode = Join-Path $LocalRuntime "node.exe"
if (-not $NodeCommand -and (Test-Path $PortableNode)) {
  $NodeCommand = @{ Source = $PortableNode }
}
$NodeMajor = 0
$NodeVersion = ""
if ($NodeCommand) {
  try {
    $NodeVersion = (& $NodeCommand.Source --version).TrimStart("v")
    [void][int]::TryParse(($NodeVersion -split "\.")[0], [ref]$NodeMajor)
  } catch {
    $NodeMajor = 0
  }
}
if ($NodeMajor -ne 22 -and (Test-Path $PortableNode)) {
  try {
    $PortableVersion = (& $PortableNode --version).TrimStart("v")
    $PortableMajor = 0
    if ([int]::TryParse(($PortableVersion -split "\.")[0], [ref]$PortableMajor) -and $PortableMajor -eq 22) {
      $NodeCommand = @{ Source = $PortableNode }
      $NodeVersion = $PortableVersion
      $NodeMajor = $PortableMajor
    }
  } catch {
    # An invalid or blocked cached binary is replaced using the pinned archive.
  }
}
if ($NodeMajor -ne 22) {
  if (-not [Environment]::Is64BitOperatingSystem) {
    Write-Host "$ProductName needs 64-bit Windows or a previously installed Node.js 22." -ForegroundColor Red
    exit 1
  }
  $Version = "22.23.4"
  $ArchiveName = "node-v$Version-win-x64.zip"
  $ExpectedSha256 = "cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20"
  $TempArchive = Join-Path $env:TEMP ("aethergrid-node-" + [guid]::NewGuid().ToString("N") + ".zip")
  $TempExtract = Join-Path $env:TEMP ("aethergrid-node-" + [guid]::NewGuid().ToString("N"))
  Write-Host "$ProductName needs Node.js 22. Installing a verified portable runtime into this app folder (no administrator rights)..." -ForegroundColor Cyan
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v$Version/$ArchiveName" -OutFile $TempArchive
    $ActualHash = (Get-FileHash -Path $TempArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($ActualHash -ne $ExpectedSha256) { throw "Downloaded Node archive failed SHA-256 verification." }
    Expand-Archive -Path $TempArchive -DestinationPath $TempExtract -Force
    $ExtractedNode = Join-Path $TempExtract "node-v$Version-win-x64\node.exe"
    if (-not (Test-Path $ExtractedNode)) { throw "The verified archive is missing node.exe." }
    New-Item -ItemType Directory -Force -Path $LocalRuntime | Out-Null
    Copy-Item -Path $ExtractedNode -Destination $PortableNode -Force
    $NodeCommand = @{ Source = $PortableNode }
    $NodeVersion = (& $NodeCommand.Source --version).TrimStart("v")
    $NodeMajor = 0
    [void][int]::TryParse(($NodeVersion -split "\.")[0], [ref]$NodeMajor)
    if ($NodeMajor -ne 22) { throw "Portable Node version validation failed." }
  } catch {
    Write-Host "Local runtime setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Your device or network may restrict downloading or running executables. The offline map still works from index.html, but live AI requires a backend process." -ForegroundColor Yellow
    exit 1
  } finally {
    Remove-Item -Force $TempArchive -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $TempExtract -ErrorAction SilentlyContinue
  }
}

# Node loads the later env file last, but inherited process variables take precedence.
# Resolve the same effective port before opening the browser.
function Get-ConfiguredPort {
  $Value = "8090"
  foreach ($FileName in @(".env", ".env.aethergrid", ".env.secrets")) {
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
    if ($env:AETHERGRID_LAUNCH_DIAGNOSTICS -eq "1") {
      Write-Host "Health probe: ok=$($Health.ok), product=$($Health.product)"
    }
    return $Health.ok -eq $true -and $Health.product -eq "$ProductName"
  } catch {
    if ($env:AETHERGRID_LAUNCH_DIAGNOSTICS -eq "1") {
      Write-Host "Health probe failed: $($_.Exception.Message)"
    }
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
        Write-Host "$ProductName is already running (PID $PreviousPid)." -ForegroundColor Yellow
        if ($env:AETHERGRID_NO_BROWSER -ne "1") { Start-Process $Url }
        exit 0
      }
      Write-Host "A previous Node process (PID $PreviousPid) exists, but $ProductName did not answer on port $Port. No duplicate server launched." -ForegroundColor Red
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
if (Test-Path (Join-Path $Root ".env.secrets")) {
  $Arguments += "--env-file=.env.secrets"
}
$Arguments += "server.mjs"

try {
  $Process = Start-Process -FilePath $NodeCommand.Source -ArgumentList $Arguments -WorkingDirectory $Root -PassThru
  $Process.Id | Set-Content $PidPath
  $Ready = $false
  for ($Attempt = 0; $Attempt -lt 60; $Attempt++) {
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
    Write-Host "$ProductName did not become ready on $HealthUrl. The server may have failed or the port may be occupied." -ForegroundColor Red
    exit 1
  }
  if ($env:AETHERGRID_NO_BROWSER -ne "1") { Start-Process $Url }
  Write-Host "$ProductName ready at $Url (PID $($Process.Id))." -ForegroundColor Cyan
  Write-Host "Run STOP-AETHERGRID.ps1 to stop the local server."
} catch {
  Remove-Item $PidPath -Force -ErrorAction SilentlyContinue
  Write-Host "$ProductName startup failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
