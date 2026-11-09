# Custom SDA

Современный кроссплатформенный аналог Steam Desktop Authenticator.

- **Backend:** Rust (Tauri 2)
- **UI:** React + Vite + TypeScript
- **Хранение:** только локально, всегда зашифровано (Argon2id + AES-256-GCM)
- **Платформы:** Windows, macOS, Linux, Android (iOS — при сборке на macOS)

## Возможности v1

- Генерация Steam Guard кодов
- Несколько аккаунтов
- Импорт `.maFile` / `shared_secret` (+ `identity_secret`)
- Подтверждения трейдов/маркета (нужна JWT-сессия в `.maFile` формата steamguard-cli)
- Обязательное шифрование паролем пользователя
- UI по современному макету (RU)

## Требования

- Node.js 18+
- Rust (rustup)
- Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) с workload **Desktop development with C++**
- WebView2 Runtime (обычно уже есть на Windows 10/11)

## Запуск (desktop)

```bash
npm install
npm run tauri dev
```

Сборка exe в папку `release/` проекта:

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
# убери старый AppData target, если задавал раньше:
Remove-Item Env:CARGO_TARGET_DIR -ErrorAction SilentlyContinue

npm run build:exe
# или debug:
# npm run build:exe:debug
```

Готовый файл: `release/custom-sda.exe`  
(установщики NSIS/MSI тоже копируются туда, если Tauri их собрал)

На Windows нужны Visual Studio Build Tools (C++) и WebView2. Если Smart App Control блокирует сборку на Desktop, временно:

```powershell
$env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\custom-sda-cargo-target"
npm run build:exe
```

Скрипт всё равно скопирует exe в `release/`.

## Android

Rust targets уже добавлены. Полная инструкция: [scripts/setup-android.md](scripts/setup-android.md)

```bash
# после установки Android Studio + SDK/NDK и ANDROID_HOME
npm run tauri android init
npm run tauri android dev
```

Release APK (Windows): `npm run build:apk`

## iOS

Сборка **только на macOS** (Xcode, CocoaPods). На Windows команда `tauri ios` в CLI недоступна.

- Mac: [scripts/setup-ios.md](scripts/setup-ios.md) → `npm run build:ios` (симулятор)
- С Windows: GitHub → **Actions** → **Build release (all platforms)** — см. [.github/CI-PIPELINE.md](.github/CI-PIPELINE.md)

## Безопасность

- Секреты не уходят в сеть для генерации кодов
- На диске только `vault.csda` (ciphertext)
- В UI не передаются `shared_secret` / `identity_secret`
- Потеря пароля = потеря доступа к vault (храните revocation codes отдельно)

## Импорт

1. Откройте вкладку с ключом
2. Выберите `.maFile` или вставьте JSON / `shared_secret`
3. Для подтверждений предпочтителен `.maFile` из [steamguard-cli](https://github.com/dyc3/steamguard-cli) с JWT `tokens`

## Вне скоупа v1

- Привязка нового authenticator через SMS
- Облачный sync
- Публикация в сторы
