# CI/CD — сборка Custom SDA (Windows, Linux, macOS, Android, iOS)

Единый справочник по пайплайну. Workflow: [`.github/workflows/build-release.yml`](workflows/build-release.yml).

## Триггеры

| Событие | Действие |
|---------|----------|
| **Push в ветку `main`** | Win/Linux + **macOS (.dmg + iOS sim)** + Android → **Release** |
| **Actions → Build release → Run workflow** | Выборочная сборка; Release **только** при push в `main` |

**macOS job:** один `macos-latest` runner — сначала **.dmg**, затем **iOS simulator .app** (не два job’а в очереди).

## Обновления (Windows / Linux / macOS)

Без signing-ключей. Клиент читает публичный GitHub API:

`https://api.github.com/repos/GoblinThug/Custom-SDA/releases/latest`

Кнопка **«Проверить обновления»** в футере: сравнивает тег релиза с версией приложения → открывает установщик (или страницу Release) в браузере. Подробнее: [docs/UPDATER.md](../docs/UPDATER.md).

Android/iOS: этот канал не используется (магазин / ручная установка APK).

## Автоматическая публикация (без ручного `git tag`)

Версия релиза берётся **только из `package.json` → `version`**. Сейчас **`1.0.2`** → GitHub Release **`v1.0.2`**.

Перед сборкой `npm run sync:version` (или `prebuild`) копирует её в `tauri.conf.json` / `Cargo.toml` / `Cargo.lock` и обновляет **текущую** версию в `README.md`, `docs/README.md`, `docs/UPDATER.md`, этом файле.

1. Поменяй **только** `"version"` в `package.json` (или `npm version patch --no-git-tag-version`, затем `npm run sync:version`).
2. Закоммить и **`git push origin main`**.
3. Дождись зелёных job’ов + **Publish GitHub Release**.
4. GitHub **сам** создаст/обновит тег и страницу **Releases** с установщиками.

Повторный push в `main` с **той же** версией: сборка заново, файлы в существующем релизе **перезапишутся** (`--clobber`).

Ручные теги для CI **не нужны** (workflow на `push: tags` отключён, чтобы не гонять двойную сборку).

**Настройка репо (один раз):** Settings → Actions → General → Workflow permissions → **Read and write permissions**.

## Сводка платформ

| Платформа | Runner CI | Локальная команда | Артефакт |
|-----------|-----------|-------------------|----------|
| **Windows** | `windows-latest` | `npm run build:exe` | `.exe`, NSIS/MSI в bundle |
| **Linux** | `ubuntu-latest` | `npm run tauri build` | `.deb`, AppImage и т.д. |
| **macOS** | `macos-latest` (job `macos`) | `npm run tauri build` | `.dmg` → Release |
| **Android** | `windows-latest` | `npm run build:apk` | `release/Custom SDA_<версия>_arm64-setup.apk` |
| **iOS** | тот же job `macos` | `npm run tauri ios build` | `.app` симулятора → **Artifacts** (не в Release) |

**Android CI:** `setup-android` с `packages: platform-tools` + `platforms;android-36` (Tauri 2 plugins требуют compileSdk ≥ 36). Rust **1.90+** (`rust-toolchain.toml`, biometric). Сборка `.so` — `tauri android build` + `scripts/build-apk.ps1`.

### Очередь macOS (arm64)

GitHub-hosted `macos-latest` — общий пул с лимитом слотов. Сообщения вроде *«job was not acquired by Runner»* / *«capacity constraints»* — **перегруз инфраструктуры**, не ошибка проекта. Рекомендации:

- **один** macOS job на push (`.dmg` + iOS подряд);
- при сбое из‑за очереди: **Re-run failed jobs** позже.

**iOS CI:** `pod install` только при реальных `pod` в Podfile; пустой Podfile с `*_macOS` без таргета в Xcode больше не валит job.

> iOS на реальное устройство / TestFlight требует Apple Signing — в CI по умолчанию только **simulator**. См. [scripts/setup-ios.md](../scripts/setup-ios.md).

## Переменные workflow (build-release.yml)

Их можно менять в шапке `build-release.yml`:

```yaml
NODE_VERSION: "20"
ANDROID_NDK_VERSION: r26b   # тот же NDK, что 26.1.10909125 локально
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

Для **текущего** workflow секреты **не обязательны** (Android — общий `src-tauri/android/sideload.keystore` в репо; iOS — simulator).

| Secret | Платформа | Назначение |
|--------|-----------|------------|
| `ANDROID_KEYSTORE_BASE64` | Android | Release keystore (base64) |
| `ANDROID_KEYSTORE_PASSWORD` | Android | |
| `ANDROID_KEY_ALIAS` | Android | |
| `ANDROID_KEY_PASSWORD` | Android | |
| `APPLE_CERTIFICATE` | iOS | `.p12` base64 |
| `APPLE_CERTIFICATE_PASSWORD` | iOS | |
| `APPLE_PROVISIONING_PROFILE` | iOS | `.mobileprovision` base64 |

После добавления секретов нужно доработать шаги signing в workflow (сейчас не настроено).

## Desktop: где лежит `target`

В репозитории [`.cargo/config.toml`](../.cargo/config.toml) задано `target-dir = "target"` в **корне** проекта (не `src-tauri/target`). CI собирает артефакты скриптом `scripts/stage-desktop-artifacts.sh`.

## Артефакты после CI

| Имя artifact | Содержимое |
|--------------|------------|
| `custom-sda-desktop-windows` | Installer / exe |
| `custom-sda-desktop-linux` | deb / AppImage |
| `custom-sda-desktop-macos` | dmg / app / zip |
| `custom-sda-android-arm64` | APK |
| `custom-sda-ios-simulator` | `.app` для симулятора |

- **Push в `main`:** файлы в **Releases** с тегом `v` + версия из `package.json` (и дубль в **Actions → Artifacts** на время хранения).

## Версии в сборке

- Единый источник: `package.json` → `npm run sync:version` → `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`.
- CI и `prebuild` вызывают sync перед сборкой; вручную править Tauri/Cargo не нужно, если версию меняли только в `package.json`.

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
git commit -m "Custom SDA 1.0.2"
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
| `scripts/stage-desktop-artifacts.sh` | Сбор desktop-артефактов |
| `scripts/build-apk.ps1` | Android на Windows |
| `scripts/build-ios.sh` | iOS на Mac |
| `scripts/copy-release.mjs` | Копирование exe в `release/` |
| `docs/README.md` | Указатель всей документации |
| `docs/UPDATER.md` | Обновления через GitHub Releases |
| `src-tauri/tauri.conf.json` | Общий конфиг Tauri |
| `src-tauri/tauri.ios.conf.json` | iOS minimum version |
