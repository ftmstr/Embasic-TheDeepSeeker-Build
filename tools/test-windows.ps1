# TUR014 local regression suite. Offline; no live DeepSeek / GitHub / Drive connections.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20+ bulunamadı.' }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python bulunamadı.' }
$tests = @(Get-ChildItem -Path tests -Filter 'test-*.cjs' -File | Sort-Object Name)
if ($tests.Count -ne 57) { throw "Test sayısı 57 yerine $($tests.Count) çıktı; beklenmeyen değişiklik." }
foreach ($test in $tests) {
    & node $test.FullName
    if ($LASTEXITCODE -ne 0) { throw "FAIL: $($test.Name)" }
}
& python tests/test-package.py
if ($LASTEXITCODE -ne 0) { throw 'FAIL: package checks' }
& python tests/test-ui-smoke.py
if ($LASTEXITCODE -ne 0) { throw 'FAIL: simulated Chromium UI' }
Write-Host 'PASS: 57 Node + 1 package + 1 simulated Chromium UI = 59 LOCAL groups.'
Write-Host 'NOT_RUN: real MV3 worker, physical Windows sleep/wake, live OAuth/GitHub/Drive.'
Write-Host 'Real MV3: powershell -ExecutionPolicy Bypass -File tools/test-mv3-windows.ps1'
