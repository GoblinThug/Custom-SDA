# Persist vault across uninstall (optional keep data) and Android backup rules.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$manifest = Join-Path $root "src-tauri\gen\android\app\src\main\AndroidManifest.xml"
$srcXml = Join-Path $root "src-tauri\android\res\xml"
$dstXml = Join-Path $root "src-tauri\gen\android\app\src\main\res\xml"

if (-not (Test-Path $manifest)) {
    Write-Warning "Android manifest missing — skip persistence patch (run tauri android init)."
    exit 0
}

New-Item -ItemType Directory -Force -Path $dstXml | Out-Null
Copy-Item -Force (Join-Path $srcXml "backup_rules.xml") $dstXml
Copy-Item -Force (Join-Path $srcXml "data_extraction_rules.xml") $dstXml

$text = Get-Content -LiteralPath $manifest -Raw -Encoding UTF8

if ($text -notmatch 'android:hasFragileUserData') {
    $text = $text -replace '(<application\s+)', '$1android:allowBackup="true" android:fullBackupContent="@xml/backup_rules" android:dataExtractionRules="@xml/data_extraction_rules" android:hasFragileUserData="true" '
}

Set-Content -LiteralPath $manifest -Value $text -Encoding UTF8 -NoNewline
Write-Host "Android vault persistence patched (backup + hasFragileUserData)."
