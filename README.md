# Custom SDA

Современный кроссплатформенный аналог **Steam Desktop Authenticator** (SDA).

- **Backend:** Rust (Tauri 2)
- **UI:** React + Vite + TypeScript
- **Хранение:** только локально, зашифрованный vault (Argon2id + AES-256-GCM)
- **Платформы:** Windows, macOS, Linux, Android; iOS — сборка на macOS или CI

**Версия:** `1.0.0` (источник — `package.json`; обновляется через `npm run sync:version`)

Полный указатель документации: [docs/README.md](docs/README.md)

## Возможности

- Steam Guard коды, несколько аккаунтов, переключение без лишних запросов
- Импорт `.maFile` / JSON (`shared_secret`, `identity_secret`, токены)
- **Подтверждения** трейдов и маркета (см. [docs/CONFIRMATIONS.md](docs/CONFIRMATIONS.md))
- Повторный вход в Steam для обновления JWT (как «Login again» в SDA)
- Шифрование паролем, автоблокировка, журнал событий на главной
- Перенос vault на телефон (QR), deep link `customsda://`
- Биометрическая разблокировка на Android / iOS
- Темы и палитры, RU / EN
- Desktop: проверка обновлений через GitHub Releases

## Требования

- Node.js 18+ (рекомендуется 20)
- Rust **1.90+** (`rust-toolchain.toml`)
- **Windows:** [Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++), WebView2
- **Linux:** webkit2gtk, patchelf (см. CI-PIPELINE)
- **macOS:** Xcode
- **Android / iOS:** см. отдельные гайды

## Быстрый старт (desktop)

```bash
npm install
npm run tauri dev
```

Release на Windows (exe в `release/`):

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npm run build:exe
```

При блокировке Smart App Control:

```powershell
$env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\custom-sda-cargo-target"
npm run build:exe
```

Подробнее: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## Мобильные платформы

| Платформа | Документация | Сборка |
|-----------|--------------|--------|
| Android | [scripts/setup-android.md](scripts/setup-android.md) | `npm run build:apk` |
| iOS | [scripts/setup-ios.md](scripts/setup-ios.md) | `npm run build:ios` (macOS) |

С Windows: CI собирает APK и macOS/iOS — [.github/CI-PIPELINE.md](.github/CI-PIPELINE.md).

## Импорт аккаунта

1. Вкладка с ключом → импорт файла или текста
2. Для подтверждений желателен maFile из [steamguard-cli](https://github.com/dyc3/steamguard-cli) **с JWT tokens**
3. Устаревшая сессия → вкладка **Подтверждения** → **Войти снова**

## Безопасность (кратко)

Локальный vault, секреты не отдаются в UI, потеря пароля = потеря vault. Детали: [docs/SECURITY.md](docs/SECURITY.md).

## Обновления

Desktop: кнопка **Проверить обновления** в футере → установщик с GitHub. Без ключей minisign: [docs/UPDATER.md](docs/UPDATER.md).

## Релизы и CI

Версию меняйте в `package.json`, пуш в `main` → сборка и GitHub Release. [CHANGELOG.md](CHANGELOG.md) | [CONTRIBUTING.md](CONTRIBUTING.md)

## Не в фокусе

- Регистрация нового authenticator через SMS
- Облачная синхронизация
- Публикация в Google Play / App Store «из коробки»
