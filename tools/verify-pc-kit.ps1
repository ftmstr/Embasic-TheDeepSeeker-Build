# TUR058 user-run read-only inspection: no installation, network, elevated permissions.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$ext = Join-Path $root 'EMBASIC_EXTENSION'
$hashes = Join-Path $root 'SHA256_EXTENSION.txt'
if (!(Test-Path -LiteralPath $ext -PathType Container)) { throw 'EMBASIC_EXTENSION missing; extract entire ZIP.' }
if (!(Test-Path -LiteralPath $hashes -PathType Leaf)) { throw 'SHA256_EXTENSION.txt missing.' }
$manifest = Get-Content -LiteralPath (Join-Path $ext 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.manifest_version -ne 3 -or $manifest.version -ne '1.18.0') { throw 'Unexpected manifest/version.' }
$rows = @(Get-Content -LiteralPath $hashes -Encoding UTF8 | Where-Object { $_.Trim() })
if ($rows.Count -ne 15) { throw "Expected 15 Chrome files; received $($rows.Count)." }
$verified = 0
foreach ($line in $rows) {
  if (-not ($line -cmatch '^([0-9a-f]{64})  ([a-zA-Z0-9_.-]+)$')) { throw "Malformed SHA record: $line" }
  $expected = $Matches[1]
  $name = $Matches[2]
  $file = Join-Path $ext $name
  if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing extension member: $name" }
  $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -cne $expected) { throw "Modified extension file: $name" }
  $verified++
}
$actualFiles = @(Get-ChildItem -LiteralPath $ext -File)
if ($actualFiles.Count -ne $verified) { throw 'Unexpected extra extension files: stop and review package.' }
Write-Host "PASS $verified/15 Chrome extension files SHA-256 matched."
Write-Host 'Next: open chrome://extensions > Developer mode > Load unpacked > select EMBASIC_EXTENSION folder.'
Write-Host 'Experimental local-only Chrome MV3 candidate; NOT a signed EXE, Windows physical acceptance, OAuth, or production approval.'
