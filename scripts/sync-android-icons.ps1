# Copy launcher icons from `tauri icon` output into the generated Android project.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$src = Join-Path $root "src-tauri\icons\android"
$dst = Join-Path $root "src-tauri\gen\android\app\src\main\res"

if (-not (Test-Path $src)) {
    throw "Missing $src - run: npm run tauri icon public/icon.png"
}

Get-ChildItem $src -Directory | Where-Object { $_.Name -like "mipmap*" } | ForEach-Object {
    $target = Join-Path $dst $_.Name
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -Force (Join-Path $_.FullName "*") $target
}

$bg = Join-Path $src "values\ic_launcher_background.xml"
if (Test-Path $bg) {
    $values = Join-Path $dst "values"
    New-Item -ItemType Directory -Force -Path $values | Out-Null
    Copy-Item -Force $bg $values
}

$adaptive = Join-Path $src "mipmap-anydpi-v26\ic_launcher.xml"
$round = Join-Path $dst "mipmap-anydpi-v26\ic_launcher_round.xml"
if (Test-Path $adaptive) {
    if (-not (Test-Path $round)) {
        Copy-Item -Force $adaptive $round
    }
}

Remove-Item -Force (Join-Path $dst "drawable\ic_launcher_background.xml") -ErrorAction SilentlyContinue
Remove-Item -Force (Join-Path $dst "drawable-v24\ic_launcher_foreground.xml") -ErrorAction SilentlyContinue

Write-Host "Android icons synced from src-tauri/icons/android"
