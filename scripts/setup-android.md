# Android setup for Custom SDA

Tauri 2 mobile target. Rust **1.90+** (`rust-toolchain.toml`).

## Rust targets

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

(`aarch64-linux-android` уже указан в `rust-toolchain.toml`.)

## 1. Install Android Studio

```powershell
winget install Google.AndroidStudio
```

**SDK Manager** — установите:

- **Android SDK Platform** (API **34+**; CI использует **36** для compileSdk плагинов Tauri 2)
- Android SDK Platform-Tools
- **NDK (Side by side)** — та же ветка, что в CI: **r26b** (`26.1.10909125`)
- Android SDK Build-Tools
- Android SDK Command-line Tools

## 2. Environment (PowerShell, User)

```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "$env:LOCALAPPDATA\Android\Sdk", "User")
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
# после установки NDK:
[System.Environment]::SetEnvironmentVariable("NDK_HOME", "$env:LOCALAPPDATA\Android\Sdk\ndk\26.1.10909125", "User")
```

Перезапустите терминал. Проверка:

```powershell
$env:ANDROID_HOME
$env:NDK_HOME
```

## 3. Init (один раз)

```bash
npm install
npm run tauri android init
```

`src-tauri/gen/android/` коммитится в репозиторий (уже инициализирован в upstream).

## 4. Dev на устройстве / эмуляторе

```bash
npm run tauri android dev
```

## 5. Release APK (Windows)

```powershell
npm run build:apk
```

Скрипт `scripts/build-apk.ps1`: sync версии, `tauri android build`, копирование в `release/Custom SDA_<version>_arm64-setup.apk`.

## Биометрия

Плагин `tauri-plugin-biometric` включён в `lib.rs`. На эмуляторе биометрия может быть недоступна.

## Troubleshooting

| Проблема | Что сделать |
|----------|-------------|
| NDK not found | Выставить `NDK_HOME`, путь как в SDK Manager |
| compileSdk / API level | Поднять platform SDK до 36 в SDK Manager |
| Gradle / Java | JDK **17+**, `JAVA_HOME` на JBR Android Studio |
| Иконки | `npm run icon:all` |

Документация: [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md), [.github/CI-PIPELINE.md](../.github/CI-PIPELINE.md).
