# CI/CD — сборка Custom SDA (Windows, Linux, macOS, Android, iOS)

Единый справочник по пайплайну. Workflow: [`.github/workflows/build-release.yml`](workflows/build-release.yml).

## Триггеры

| Событие | Действие |
|---------|----------|
| **Actions → Build release (all platforms) → Run workflow** | Ручной запуск, можно отключить отдельные платформы |
| **Push тега `v*`** (например `v4.0.2`) | Полная сборка всех включённых job’ов |

## Сводка платформ

| Платформа | Runner CI | Локальная команда | Артефакт |
|-----------|-----------|-------------------|----------|
| **Windows** | `windows-latest` | `npm run build:exe` | `.exe`, NSIS/MSI в bundle |
| **Linux** | `ubuntu-latest` | `npm run tauri build` | `.deb`, AppImage и т.д. |
| **macOS** | `macos-latest` | `npm run tauri build` | `.dmg`, `.app` |
| **Android** | `windows-latest` | `npm run build:apk` | `release/Custom SDA_<версия>_arm64-setup.apk` |
| **iOS** | `macos-latest` | `npm run build:ios` | `.app` для симулятора (по умолчанию; не IPA) |

> iOS на реальное устройство / TestFlight требует Apple Signing — в CI по умолчанию только **simulator**. См. [scripts/setup-ios.md](../scripts/setup-ios.md).

## Переменные workflow (build-release.yml)

Их можно менять в шапке `build-release.yml`:

```yaml
NODE_VERSION: "20"
ANDROID_NDK_VERSION: "26.1.10909125"
JAVA_VERSION: "17"
```

## Локальные переменные окружения

### Windows (desktop)

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
# при блокировке Smart App Control:
# $env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\custom-sda-cargo-target"
npm install
npm run build:exe
```

Нужны: **Visual Studio Build Tools (C++)**, **WebView2**.

### Linux (desktop)

```bash
# Debian/Ubuntu
sudo apt install libwebkit2gtk-4.1-dev librsvg2-dev patchelf libssl-dev libayatana-appindicator3-dev
npm ci
npm run tauri build
```

### macOS (desktop)

```bash
# Xcode из App Store
npm ci
npm run tauri build
```

### Android (локально, Windows)

См. [scripts/setup-android.md](../scripts/setup-android.md).

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NDK_HOME = "$env:ANDROID_HOME\ndk\26.1.10909125"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"   # или ваша JDK 17+

rustup target add aarch64-linux-android
npm run tauri android init   # один раз
npm run build:apk
```

### iOS (только macOS)

См. [scripts/setup-ios.md](../scripts/setup-ios.md).

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
brew install cocoapods
npm run tauri ios init -- --ci
cd src-tauri/gen/apple && pod install && cd ../../..
npm run build:ios
```

## Rust targets

```bash
# Desktop — ставит rustup по платформе
# Android
rustup target add aarch64-linux-android
# iOS (на Mac)
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
```

## GitHub Secrets (опционально, для прод-подписи)

Для **текущего** workflow секреты **не обязательны** (Android — debug keystore, iOS — simulator).

| Secret | Платформа | Назначение |
|--------|-----------|------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Desktop updater | Подпись обновлений Tauri |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Desktop | Пароль ключа |
| `ANDROID_KEYSTORE_BASE64` | Android | Release keystore (base64) |
| `ANDROID_KEYSTORE_PASSWORD` | Android | |
| `ANDROID_KEY_ALIAS` | Android | |
| `ANDROID_KEY_PASSWORD` | Android | |
| `APPLE_CERTIFICATE` | iOS | `.p12` base64 |
| `APPLE_CERTIFICATE_PASSWORD` | iOS | |
| `APPLE_PROVISIONING_PROFILE` | iOS | `.mobileprovision` base64 |

После добавления секретов нужно доработать шаги signing в workflow (сейчас не настроено).

## Артефакты после CI

| Имя artifact | Содержимое |
|--------------|------------|
| `custom-sda-desktop-windows` | Installer / exe |
| `custom-sda-desktop-linux` | deb / AppImage |
| `custom-sda-desktop-macos` | dmg / app |
| `custom-sda-android-arm64` | APK |
| `custom-sda-ios-simulator` | `.app` для симулятора |

Скачивание: **Actions → выбранный run → Artifacts**.

## Версии в сборке

- Версия приложения в UI: `package.json` → `version` (и обновляйте `src-tauri/tauri.conf.json` при релизе).
- Rust crate `Cargo.toml` `version` может отставать — для релиза лучше синхронизировать вручную.

## Что коммитить в git

| Путь | Коммитить? |
|------|------------|
| `src/`, `src-tauri/` (кроме `target/`) | да |
| `package-lock.json` | да |
| `src-tauri/gen/android/` | да, если уже инициализирован |
| `src-tauri/gen/apple/` | обычно **нет** — создаётся `tauri ios init` в CI |
| `node_modules/`, `dist/`, `target/`, `release/` | **нет** (в `.gitignore`) |

## Первый push на GitHub

```bash
git init
git add .
git commit -m "Custom SDA 4.0.1"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Запуск сборки: **Actions → Build release (all platforms) → Run workflow**.

## Ускорение / отладка

- Отключите ненужные платформы в `workflow_dispatch` (галочки).
- Android и iOS — самые долгие job’ы (~30–90 мин).
- Логи: каждый job на своём runner’е; desktop — три параллельных matrix job.

## Связанные файлы

| Файл | Роль |
|------|------|
| `.github/workflows/build-release.yml` | Пайплайн CI |
| `scripts/build-apk.ps1` | Android на Windows |
| `scripts/build-ios.sh` | iOS на Mac |
| `scripts/copy-release.mjs` | Копирование exe в `release/` |
| `src-tauri/tauri.conf.json` | Общий конфиг Tauri |
| `src-tauri/tauri.ios.conf.json` | iOS minimum version |
