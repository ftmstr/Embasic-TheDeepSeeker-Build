# Real Chrome MV3 acceptance; requires Windows desktop session and Python Playwright.
# NO real GitHub/Drive/DeepSeek calls: tests use local synthetic tasks only.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python bulunamadı.' }
$chromePaths = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)
# Honor an explicitly installed Chrome/Chromium path for isolated PC acceptance.
$chromeExe = if ($env:CHROMIUM_PATH -and (Test-Path $env:CHROMIUM_PATH)) { $env:CHROMIUM_PATH } else {
  $chromePaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
if (-not $chromeExe) { throw 'Google Chrome exe bulunamadı. CHROMIUM_PATH ortam değişkenini ayarlayın.' }
$env:CHROMIUM_PATH = $chromeExe
$env:EMBASIC_HEADLESS = '0'
$env:EMBASIC_REQUIRE_MV3 = '1'
$env:EMBASIC_MV3_WAIT_MS = '15000'
Write-Host "Gerçek Chrome MV3 testi: $chromeExe (sentetik veri, geçici profil)"
python tests/test-mv3-extension.py
if ($LASTEXITCODE -ne 0) { throw "FAIL: Real Chrome MV3 acceptance (exit=$LASTEXITCODE)." }
Write-Host 'PASS: Real Chrome MV3 acceptance'
