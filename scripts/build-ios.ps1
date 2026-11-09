# iOS cannot be built locally on Windows — use a Mac or GitHub Actions.
$ErrorActionPreference = "Stop"
if ($env:OS -ne "Windows_NT") {
    $bash = Get-Command bash -ErrorAction SilentlyContinue
    if ($bash) {
        & bash (Join-Path $PSScriptRoot "build-ios.sh") @args
        exit $LASTEXITCODE
    }
}
Write-Host @"

Custom SDA: iOS build is not available on this machine.

Tauri iOS requires macOS, full Xcode, CocoaPods, and Rust iOS targets.
The 'tauri ios' CLI is not included in the Windows build of @tauri-apps/cli.

Options:
  1) On a Mac:  npm run build:ios
                 npm run build:ios:device   (needs Apple signing for IPA)
  2) In the cloud: push the repo to GitHub and run workflow 'Build iOS'
     (.github/workflows/build-ios.yml -> Actions -> Run workflow)

Docs: scripts/setup-ios.md

"@ -ForegroundColor Yellow
exit 1
