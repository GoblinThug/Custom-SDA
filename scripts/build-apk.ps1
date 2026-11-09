# Build arm64 Android APK on Windows without Developer Mode (copies instead of symlinks).
$ErrorActionPreference = "Stop"
# GitHub Actions pwsh: rustc/tauri log to stderr; without this, *>&1 still throws NativeCommandError.
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Invoke-ProcessStream {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$ArgumentList
    )
    $log = [System.Collections.Generic.List[string]]::new()
    & $FilePath @ArgumentList 2>&1 | ForEach-Object {
        $text = if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.ToString() } else { "$_" }
        Write-Host $text
        [void]$log.Add($text)
    }
    $exit = $LASTEXITCODE
    if ($null -eq $exit) { $exit = 0 }
    return @{ ExitCode = $exit; Log = ($log -join [Environment]::NewLine) }
}

function Copy-JniWithRetry {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$JniDir
    )
    $name = Split-Path $Source -Leaf
    $dest = Join-Path $JniDir $name
    $androidDir = Join-Path $root "src-tauri\gen\android"
    if (Test-Path (Join-Path $androidDir "gradlew.bat")) {
        Push-Location $androidDir
        try { & .\gradlew.bat --stop 2>$null } finally { Pop-Location }
        Start-Sleep -Seconds 1
    }
    foreach ($attempt in 1..12) {
        try {
            if (Test-Path $dest) {
                Remove-Item -LiteralPath $dest -Force -ErrorAction Stop
            }
            Copy-Item -LiteralPath $Source -Destination $dest -Force
            return
        } catch {
            if ($attempt -eq 12) { throw }
            Start-Sleep -Milliseconds (250 * $attempt)
        }
    }
}

function Find-AndroidReleaseSo {
    param([string]$ProjectRoot)
    $relPaths = @(
        "target\aarch64-linux-android\release\libcustom_sda_lib.so",
        "src-tauri\target\aarch64-linux-android\release\libcustom_sda_lib.so"
    )
    foreach ($rel in $relPaths) {
        $p = Join-Path $ProjectRoot $rel
        if (Test-Path $p) { return $p }
    }
    $found = Get-ChildItem -Path $ProjectRoot -Recurse -Filter "libcustom_sda_lib.so" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "aarch64-linux-android[\\/]release" } |
        Select-Object -First 1
    if ($found) { return $found.FullName }
    return $null
}

function Resolve-NdkLibcxx {
    param([string]$NdkHome)
    $prebuiltRoot = Join-Path $NdkHome "toolchains\llvm\prebuilt"
    if (-not (Test-Path $prebuiltRoot)) {
        throw "NDK prebuilt toolchain missing under $prebuiltRoot"
    }
    $hostDir = Get-ChildItem -Path $prebuiltRoot -Directory | Select-Object -First 1
    if (-not $hostDir) {
        throw "No LLVM prebuilt host dir in $prebuiltRoot"
    }
    $libcxx = Join-Path $hostDir.FullName "sysroot\usr\lib\aarch64-linux-android\libc++_shared.so"
    if (-not (Test-Path $libcxx)) {
        throw "libc++_shared.so not found at $libcxx"
    }
    return $libcxx
}

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

if (-not $env:NDK_HOME -or -not (Test-Path $env:NDK_HOME)) {
    $fallback = Join-Path $env:ANDROID_HOME "ndk\26.1.10909125"
    if (Test-Path $fallback) {
        $env:NDK_HOME = $fallback
    } else {
        $discovered = Get-ChildItem -Path (Join-Path $env:ANDROID_HOME "ndk") -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            Select-Object -First 1
        if ($discovered) {
            $env:NDK_HOME = $discovered.FullName
        }
    }
}
if (-not $env:NDK_HOME -or -not (Test-Path $env:NDK_HOME)) {
    throw "NDK_HOME not set. Set NDK_HOME or install NDK (CI: nttld/setup-ndk)."
}
$env:ANDROID_NDK_HOME = $env:NDK_HOME
$env:ANDROID_NDK_ROOT = $env:NDK_HOME
Write-Host "Using NDK_HOME=$($env:NDK_HOME)"

$rustLog = ""
$rustExit = $null
Push-Location $root
try {
    npm run build

    if (-not (Test-Path "src-tauri\gen\android\gradlew.bat")) {
        throw "Android project missing. Run: npm run tauri android init -- --ci"
    }

    # Compiles libcustom_sda_lib.so (--apk is skipped; Gradle runs below and avoids jniLibs lock on CI).
    Write-Host "Building Rust for aarch64-linux-android (release)..."
    Write-Host "Note: first CI compile can take 20-45 min; you should see Compiling lines below."
    $tauri = Join-Path $root "node_modules\.bin\tauri.cmd"
    if (-not (Test-Path $tauri)) {
        $tauri = Join-Path $root "node_modules\.bin\tauri"
    }
    if (-not $env:CI) {
        $env:CI = "true"
    }
    $env:CARGO_TERM_COLOR = "always"
    # Frontend already built via npm run build above (JSON via file — pwsh/cmd strip inline quotes).
    $tauriBuildConfig = Join-Path $env:TEMP "custom-sda-tauri-android-build.json"
    [System.IO.File]::WriteAllText($tauriBuildConfig, '{"build":{"beforeBuildCommand":""}}')
    $rustResult = Invoke-ProcessStream -FilePath $tauri -ArgumentList @(
        "android", "build", "--target", "aarch64", "--ci", "-v",
        "--config", $tauriBuildConfig
    )
    Remove-Item -LiteralPath $tauriBuildConfig -Force -ErrorAction SilentlyContinue
    $rustLog = $rustResult.Log
    $rustExit = $rustResult.ExitCode
} finally {
    Pop-Location
}

$so = Find-AndroidReleaseSo -ProjectRoot $root
if (-not $so) {
    $detail = if ($rustLog) { "`n$rustLog" } else { "" }
    $exitHint = if ($null -ne $rustExit) { " (tauri exit $rustExit)" } else { "" }
    throw "Missing libcustom_sda_lib.so under target/aarch64-linux-android/release. Rust Android build did not complete$exitHint.$detail"
}
if ($rustExit -ne 0) {
    Write-Warning "tauri android build exited $rustExit (common on Windows without Developer Mode symlinks); using $so"
}
Write-Host "Using native lib: $so"

$jni = Join-Path $root "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a"
$assets = Join-Path $root "src-tauri\gen\android\app\src\main\assets"
$libcxx = Resolve-NdkLibcxx -NdkHome $env:NDK_HOME

New-Item -ItemType Directory -Force -Path $jni | Out-Null
New-Item -ItemType Directory -Force -Path $assets | Out-Null
Copy-JniWithRetry -Source $so -JniDir $jni
Copy-JniWithRetry -Source $libcxx -JniDir $jni
Remove-Item -Recurse -Force (Join-Path $assets "*") -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $root "dist\*") $assets
Copy-Item -Force (Join-Path $root "src-tauri\tauri.conf.json") $assets

& (Join-Path $root "scripts\sync-android-icons.ps1")

$androidDir = Join-Path $root "src-tauri\gen\android"
Push-Location $androidDir
try {
    Write-Host "Running Gradle assembleArm64Release (Rust prebuilt; jniLibs copied manually)..."
    $gradle = Join-Path $androidDir "gradlew.bat"
    $gradleResult = Invoke-ProcessStream -FilePath $gradle -ArgumentList @(
        "assembleArm64Release",
        "-x", "rustBuildArm64Release",
        "-x", "rustBuildUniversalRelease",
        "--console=plain"
    )
    if ($gradleResult.ExitCode -ne 0) {
        throw "Gradle assembleArm64Release failed (exit $($gradleResult.ExitCode))."
    }
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
