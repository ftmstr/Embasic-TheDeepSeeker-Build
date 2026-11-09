# Set the OAuth Client ID created for this exact Chrome extension ID.
# Run from PowerShell after extracting the source ZIP:
# .\tools\configure-google-oauth.ps1 -ClientId '...apps.googleusercontent.com'
param(
    [Parameter(Mandatory=$true)][string]$ClientId
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($ClientId -notmatch '^[A-Za-z0-9-]+\.apps\.googleusercontent\.com$') {
    throw 'Client ID biçimi gecersiz. Google Cloud OAuth Chrome Extension client ID kullanin.'
}
$manifestPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'extension\manifest.json'
if (!(Test-Path $manifestPath)) { throw "manifest.json bulunamadi: $manifestPath" }
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest.oauth2.client_id = $ClientId
$json = $manifest | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($manifestPath, $json + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Host 'Google OAuth Client ID kaydedildi. chrome://extensions uzantisini yeniden yukleyin.'
