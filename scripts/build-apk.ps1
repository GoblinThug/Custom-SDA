# Build arm64 Android APK on Windows without Developer Mode (copies instead of symlinks).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = "$env:USERPROFILE\Android\Sdk"
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$bundledJdk = "C:\Program Files\Java\jdk-25.0.4.1"
if (Test-Path $bundledJdk) {
    $env:JAVA_HOME = $bundledJdk
} elseif (-not $env:JAVA_HOME -or -not (Test-Path $env:JAVA_HOME)) {
    throw "JAVA_HOME not set and bundled JDK not found at $bundledJdk. Install JDK 17+ or set JAVA_HOME (CI: setup-java)."
}
if (-not $env:NDK_HOME) {
    $env:NDK_HOME = Join-Path $env:ANDROID_HOME "ndk\26.1.10909125"
}

Push-Location $root
try {
    npm run build

    # Compiles libcustom_sda_lib.so for aarch64 (may fail after compile on symlink — ignore).
    $tauri = Join-Path $root "node_modules\.bin\tauri.cmd"
    if (-not (Test-Path $tauri)) {
        $tauri = Join-Path $root "node_modules\.bin\tauri"
    }
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $null = & $tauri android build --apk --target aarch64 2>&1
    } finally {
        $ErrorActionPreference = $prevEap
    }
} finally {
    Pop-Location
}

$so = Join-Path $root "target\aarch64-linux-android\release\libcustom_sda_lib.so"
if (-not (Test-Path $so)) {
    throw "Missing $so - Rust Android build did not complete."
}

$jni = Join-Path $root "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a"
$assets = Join-Path $root "src-tauri\gen\android\app\src\main\assets"
$libcxx = Join-Path $env:NDK_HOME "toolchains\llvm\prebuilt\windows-x86_64\sysroot\usr\lib\aarch64-linux-android\libc++_shared.so"

New-Item -ItemType Directory -Force -Path $jni | Out-Null
New-Item -ItemType Directory -Force -Path $assets | Out-Null
Copy-Item -Force $so $jni
Copy-Item -Force $libcxx $jni
Remove-Item -Recurse -Force (Join-Path $assets "*") -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $root "dist\*") $assets
Copy-Item -Force (Join-Path $root "src-tauri\tauri.conf.json") $assets

& (Join-Path $root "scripts\sync-android-icons.ps1")

$androidDir = Join-Path $root "src-tauri\gen\android"
Push-Location $androidDir
try {
    & .\gradlew.bat assembleArm64Release -x rustBuildArm64Release -x rustBuildUniversalRelease
} finally {
    Pop-Location
}

$unsigned = Join-Path $root "src-tauri\gen\android\app\build\outputs\apk\arm64\release\app-arm64-release-unsigned.apk"
if (-not (Test-Path $unsigned)) {
    throw "Gradle did not produce APK at $unsigned"
}

$releaseDir = Join-Path $root "release"
$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
$outApk = Join-Path $releaseDir "Custom SDA_${version}_arm64-setup.apk"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
if (-not (Test-Path $env:JAVA_HOME)) {
    throw "JAVA_HOME not found: $env:JAVA_HOME - install JDK 17+ or set JAVA_HOME for apksigner."
}

$stagingApk = Join-Path $env:TEMP "custom-sda-sign-staging-$([guid]::NewGuid().ToString('n')).apk"
Copy-Item -Force $unsigned $stagingApk

$androidUser = Join-Path $env:USERPROFILE ".android"
$ks = Join-Path $androidUser "debug.keystore"
if (-not (Test-Path $ks)) {
    New-Item -ItemType Directory -Force -Path $androidUser | Out-Null
    & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore $ks -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
    if ($LASTEXITCODE -ne 0) {
        throw "keytool failed to create debug.keystore"
    }
}

$apksigner = Get-ChildItem (Join-Path $env:ANDROID_HOME "build-tools") -Recurse -Filter "apksigner.bat" | Select-Object -First 1 -ExpandProperty FullName
if (-not $apksigner) {
    throw "apksigner.bat not found under ANDROID_HOME build-tools"
}

$signPrevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$signLog = & $apksigner sign --v1-signing-enabled true --v2-signing-enabled true --ks $ks --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey --out $outApk $stagingApk 2>&1
$signExit = $LASTEXITCODE
$ErrorActionPreference = $signPrevEap
Remove-Item -Force $stagingApk -ErrorAction SilentlyContinue
if ($signExit -ne 0) {
    Remove-Item -Force $outApk -ErrorAction SilentlyContinue
    throw "apksigner sign failed (exit $signExit): $signLog"
}

$verifyPrevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$verifyLog = & $apksigner verify --verbose $outApk 2>&1 | Out-String
$verifyExit = $LASTEXITCODE
$ErrorActionPreference = $verifyPrevEap
if ($verifyExit -ne 0 -or $verifyLog -notmatch "Verifies") {
    Remove-Item -Force $outApk -ErrorAction SilentlyContinue
    throw "APK signature invalid after sign: $verifyLog"
}

Write-Host "APK (signed & verified): $outApk"
