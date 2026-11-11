<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Custom SDA" width="96" height="96" />
</p>

<h1 align="center">Custom SDA</h1>

<p align="center">
  <strong>Современный Steam Desktop Authenticator</strong> для Windows, macOS, Linux, Android и iOS<br />
  Steam Guard · подтверждения · локальное зашифрованное хранилище · перенос между устройствами
</p>

<p align="center">
  <a href="#-русский">Русский</a> · <a href="#-english">English</a>
</p>

<p align="center">
  <a href="https://github.com/GoblinThug/Custom-SDA/releases/latest"><img src="https://img.shields.io/github/v/release/GoblinThug/Custom-SDA?style=for-the-badge&label=Release&color=2ea44f" alt="Release" /></a>
  <a href="https://github.com/GoblinThug/Custom-SDA/releases"><img src="https://img.shields.io/github/downloads/GoblinThug/Custom-SDA/total?style=for-the-badge&label=Downloads&color=0969da" alt="Downloads" /></a>
  <a href="https://github.com/GoblinThug/Custom-SDA"><img src="https://img.shields.io/badge/Platform-Win%20%7C%20macOS%20%7C%20Linux%20%7C%20Android%20%7C%20iOS-111827?style=for-the-badge&logo=tauri&logoColor=white" alt="Platform" /></a>
  <a href="https://github.com/GoblinThug/Custom-SDA"><img src="https://img.shields.io/badge/Stack-Tauri%202%20%2B%20React-0f172a?style=for-the-badge&logo=react&logoColor=61dafb" alt="Stack" /></a>
</p>

<p align="center">
  <a href="https://github.com/GoblinThug/Custom-SDA/releases/latest"><strong>⬇️ Скачать последнюю версию</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/GoblinThug/Custom-DSA/issues">🐞 Сообщить о проблеме</a>
  &nbsp;·&nbsp;
  <a href="docs/README.md">📚 Документация</a>
</p>

---

# 🇷🇺 Русский

## ✨ Что это

**Custom SDA** — кроссплатформенный аналог классического **Steam Desktop Authenticator**: коды Steam Guard, несколько аккаунтов, подтверждения трейдов и маркета, импорт `.maFile` и вход через Steam. Все секреты хранятся **только локально** в зашифрованном vault (Argon2id + AES-256-GCM).

| | Возможность |
|---|---|
| 🔢 | Коды Steam Guard с таймером, переключение аккаунтов |
| 🛡️ | Подтверждения Steam (нужны `identity_secret` и активная сессия) |
| 📥 | Импорт `.maFile` / JSON, привязка authenticator через Steam (SMS) |
| 🔐 | Пароль vault, автоблокировка, смена пароля |
| 📦 | Экспорт / импорт vault (файл `.csda`) для другого устройства |
| 📱 | Android / iOS: биометрия, перенос аккаунта по QR, deep link `customsda://` |
| 🎨 | Тёмная / светлая тема, палитры, русский и английский |
| ⬆️ | Desktop: проверка обновлений через GitHub Releases; Android: установка APK поверх старой |

Текущая версия в репозитории: **`1.0.2`** (актуальный номер всегда в [Releases](https://github.com/GoblinThug/Custom-SDA/releases)).

---

## ⬇️ Скачать и установить

Готовые сборки: **[GitHub Releases →](https://github.com/GoblinThug/Custom-SDA/releases)**

### 🪟 Windows

| Файл | Когда брать |
|---|---|
| `custom-sda.exe` / установщик из релиза | Запуск без сборки из исходников |
| Сборка из репо | `npm run build:exe` → папка `release/` |

1. Скачайте артефакт из Releases (или соберите сами).
2. Запустите установщик или `custom-sda.exe`.
3. Создайте пароль vault и добавьте аккаунт (maFile или вход Steam).

> ⚠️ **Smart App Control** может блокировать локальную сборку. Задайте отдельный каталог Cargo:  
> `$env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\custom-sda-cargo-target"` и снова `npm run build:exe`.

### 🍎 macOS / 🐧 Linux

В релизе — `.dmg`, `.AppImage`, `.deb` (см. имена в [CI-PIPELINE](.github/CI-PIPELINE.md)). Локально:

```bash
npm install
npm run sync:version
npm run tauri build
```

### 📱 Android

| Файл | Когда брать |
|---|---|
| `Custom SDA_<версия>_arm64-setup.apk` | Sideload на телефон (arm64) |

1. Скачайте APK с Releases.
2. Установите поверх старой версии **той же подписи** — vault сохранится.
3. При удалении Android может предложить **оставить данные** — тогда после переустановки введите пароль vault или восстановите `.csda` из настроек.

Подробнее о подписи APK: [src-tauri/android/README.md](src-tauri/android/README.md).

### 🍏 iOS

Сборка на Mac или артефакты CI (симулятор / устройство). См. [scripts/setup-ios.md](scripts/setup-ios.md).

---

## 🚀 Быстрый старт

1. Запустите приложение → **создайте пароль** локального vault (или разблокируйте существующий).
2. **Аккаунты** → импортируйте `.maFile` или войдите через Steam.
3. На **Главной** — код Guard для выбранного аккаунта.
4. **Подтверждения** — если есть сессия и `identity_secret`, список подтянется сам; иначе «Войти снова» или импорт maFile с токенами ([детали](docs/CONFIRMATIONS.md)).
5. **Настройки → Резервная копия** — экспорт `.csda` для переноса на другое устройство.

---

## 📚 Основные возможности

### 🔢 Steam Guard

- Несколько аккаунтов, выбор активного, аватары
- Копирование кода, таймер 30 секунд

### 🛡️ Подтверждения

- Список ожидающих, принять / отклонить
- Повторный вход в Steam только когда **нет рабочей сессии** (при активной сессии — только обновление списка)

### 📥 Импорт и привязка

- Файл или вставка JSON (формат maFile / steamguard-cli)
- Полная привязка через Steam (коды, SMS при необходимости)

### 📦 Резервное копирование

- **Настройки → Резервная копия**: экспорт зашифрованного `vault.csda`
- Импорт на другом устройстве с тем же паролем шифрования

### 📱 Мобильные функции

- Биометрия (отпечаток / Face ID) после разблокировки паролем
- Передача аккаунта по QR между ПК и телефоном

---

## ⬆️ Обновления

- **Windows / Linux / macOS:** кнопка **Проверить обновления** в футере → страница загрузки на GitHub ([UPDATER](docs/UPDATER.md)).
- **Android:** скачайте новый APK из Releases и установите **поверх** текущей (нужна та же подпись релиза).
- **iOS:** обновление через новую сборку / TestFlight (как настроите у себя).

---

## 🔐 Безопасность

- Секреты **не покидают устройство**; UI не отдаёт `shared_secret` / `identity_secret` наружу.
- Потеря пароля vault = **невозможность** открыть данные (восстановление только из `.csda`, если делали экспорт).
- Файл `.csda` зашифрован — храните его как носитель секретов.

Подробнее: [docs/SECURITY.md](docs/SECURITY.md).

---

## 🛟 Проблемы?

| Ситуация | Что сделать |
|---|---|
| Нет подтверждений | Нужны JWT в maFile ([steamguard-cli](https://github.com/dyc3/steamguard-cli)) или «Войти снова» |
| Только код, без подтверждений | В maFile нет `identity_secret` — импортируйте полный maFile |
| Android не обновляется поверх | Другая подпись APK — удалите старую версию (сохраните `.csda`!) |
| Сбросили vault случайно | Импорт `.csda` из резервной копии |
| Сборка Windows падает | Smart App Control → отдельный `CARGO_TARGET_DIR` (см. выше) |
| Вопросы и баги | [Issues](https://github.com/GoblinThug/Custom-SDA/issues) |

---

## 🛠️ Для разработчиков

Подробнее: [CONTRIBUTING.md](CONTRIBUTING.md) · [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) · [docs/SECURITY.md](docs/SECURITY.md) · [CHANGELOG.md](CHANGELOG.md)

```bash
git clone https://github.com/GoblinThug/Custom-SDA.git
cd Custom-SDA
npm install
npm run tauri dev
```

Сборка:

```powershell
# Windows exe → release/
npm run build:exe

# Android APK
npm run build:apk
```

Версия везде из `package.json`: `npm run sync:version`.

### Релиз через GitHub Actions

Workflow [`.github/workflows/build-release.yml`](.github/workflows/build-release.yml) — desktop, Android, iOS. Описание пайплайна: [.github/CI-PIPELINE.md](.github/CI-PIPELINE.md).

1. Поднимите `version` в `package.json`.
2. Закоммитьте и запушьте в `main`.
3. В **Releases** появится `vX.Y.Z` с артефактами.

---

# 🇬🇧 English

## ✨ What it is

**Custom SDA** is a cross-platform **Steam Desktop Authenticator** replacement: Steam Guard codes, multiple accounts, trade/market confirmations, `.maFile` import, and Steam sign-in. Secrets stay **on device only**, in an encrypted vault (Argon2id + AES-256-GCM).

| | Feature |
|---|---|
| 🔢 | Steam Guard codes with timer, account switching |
| 🛡️ | Steam confirmations (`identity_secret` + live session) |
| 📥 | `.maFile` / JSON import, authenticator linking via Steam |
| 🔐 | Vault password, auto-lock, change password |
| 📦 | Vault export / import (`.csda`) for another device |
| 📱 | Android / iOS: biometrics, QR transfer, `customsda://` deep links |
| 🎨 | Dark / light themes, palettes, RU / EN |
| ⬆️ | Desktop update check via GitHub Releases; Android in-place APK updates |

Repo version: **`1.0.2`** (see [Releases](https://github.com/GoblinThug/Custom-SDA/releases) for the latest).

---

## ⬇️ Download & install

Prebuilt builds: **[GitHub Releases →](https://github.com/GoblinThug/Custom-SDA/releases)**

### 🪟 Windows

| Artifact | Notes |
|---|---|
| `custom-sda.exe` / installer | From Releases or `npm run build:exe` → `release/` |

> ⚠️ **Smart App Control** may block local builds. Use  
> `$env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\custom-sda-cargo-target"` then `npm run build:exe`.

### 🍎 macOS / 🐧 Linux

`.dmg`, `.AppImage`, `.deb` in Releases — see [.github/CI-PIPELINE.md](.github/CI-PIPELINE.md).

### 📱 Android

`Custom SDA_<version>_arm64-setup.apk` — sideload arm64. Install **over** the previous release-signed APK to keep the vault. See [src-tauri/android/README.md](src-tauri/android/README.md).

### 🍏 iOS

Build on a Mac or use CI artifacts — [scripts/setup-ios.md](scripts/setup-ios.md).

---

## 🚀 Quick start

1. Launch → **create or unlock** the vault password.
2. **Accounts** → import `.maFile` or sign in with Steam.
3. **Home** → Guard code for the selected account.
4. **Confirmations** — auto-load when session + `identity_secret` are OK; otherwise sign in again or import a maFile with tokens ([docs](docs/CONFIRMATIONS.md)).
5. **Settings → Backup** → export `.csda` to move to another device.

---

## ⬆️ Updates

- Desktop: **Check for updates** in the footer.
- Android: download a new APK from Releases and install over the existing app (same release signing).
- iOS: new build as you distribute it.

Details: [docs/UPDATER.md](docs/UPDATER.md).

---

## 🔐 Security

- Secrets stay local; the UI does not expose raw secrets.
- Lost vault password cannot be recovered without a `.csda` backup.
- Treat `.csda` exports like key material.

[docs/SECURITY.md](docs/SECURITY.md)

---

## 🛟 Troubleshooting

| Issue | What to try |
|---|---|
| No confirmations | JWT tokens in maFile ([steamguard-cli](https://github.com/dyc3/steamguard-cli)) or sign in again |
| Code only, no confirmations | Missing `identity_secret` — import a full maFile |
| Android update rejected | Different APK signature — uninstall (export `.csda` first!) |
| Accidental vault wipe | Import `.csda` backup |
| Windows build blocked | Separate `CARGO_TARGET_DIR` (see above) |
| Bugs | [Issues](https://github.com/GoblinThug/Custom-SDA/issues) |

---

## 🛠️ For developers

[CONTRIBUTING.md](CONTRIBUTING.md) · [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) · [CHANGELOG.md](CHANGELOG.md)

```bash
git clone https://github.com/GoblinThug/Custom-SDA.git
cd Custom-SDA
npm install
npm run tauri dev
```

```powershell
npm run build:exe   # Windows → release/
npm run build:apk   # Android APK
```

Bump `package.json` version → `npm run sync:version` → push `main` → [.github/CI-PIPELINE.md](.github/CI-PIPELINE.md).

---

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="" width="40" height="40" /><br />
  <strong>Custom SDA</strong> · by Goblin_Thug<br />
  <a href="https://github.com/GoblinThug/Custom-SDA/releases">Downloads</a>
  ·
  <a href="https://github.com/GoblinThug/Custom-SDA">GitHub</a>
  ·
  <a href="https://github.com/GoblinThug/Custom-SDA/issues">Issues</a>
  ·
  <a href="CONTRIBUTING.md">Contributing</a>
  ·
  <a href="docs/SECURITY.md">Security</a>
  ·
  <a href="docs/README.md">Docs</a>
</p>
