# Android setup for Custom SDA

Rust targets are already added:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## 1. Install Android Studio

```bash
winget install Google.AndroidStudio
```

In SDK Manager install:

- Android SDK Platform (API 34+)
- Android SDK Platform-Tools
- NDK (Side by side)
- Android SDK Build-Tools
- Android SDK Command-line Tools

## 2. Environment

PowerShell (User scope):

```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
# NDK path after install, e.g.:
# [System.Environment]::SetEnvironmentVariable("NDK_HOME", "$env:LOCALAPPDATA\Android\Sdk\ndk\<version>", "User")
```

Restart the terminal.

## 3. Init & run

```bash
npm run tauri android init
npm run tauri android dev
```

The Rust core (`#[cfg_attr(mobile, tauri::mobile_entry_point)]`) is already mobile-ready.
