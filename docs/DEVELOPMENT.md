# Разработка

## Требования

| Инструмент | Версия |
|------------|--------|
| Node.js | 18+ (CI: 20) |
| Rust | 1.90+ (`rust-toolchain.toml`) |
| npm | из комплекта Node |

Desktop: WebView2 (Windows), webkit2gtk (Linux), Xcode (macOS).

## Установка

```bash
git clone https://github.com/GoblinThug/Custom-SDA.git
cd Custom-SDA
npm install
```

## Команды

| Команда | Назначение |
|---------|------------|
| `npm run tauri dev` | Desktop: Vite + Tauri в dev-режиме |
| `npm run build` | Только frontend (`tsc` + Vite) |
| `npm run sync:version` | `package.json` → `tauri.conf.json`, `Cargo.toml`, `Cargo.lock` |
| `npm run build:exe` | Release Windows → `release/` |
| `npm run build:exe:debug` | Debug exe в `release/` |
| `npm run build:apk` | Android APK (Windows, см. setup-android) |
| `npm run build:ios` | iOS simulator (только macOS) |
| `npm run icon:all` | Иконки Tauri + Android из `public/icon.png` |

`prebuild` и CI вызывают `sync:version` автоматически (Tauri, Cargo, строки версии в README и docs).

## Проверки перед коммитом

```bash
npx tsc --noEmit
npm run build
cd src-tauri && cargo check
```

## Структура (кратко)

- `src/` — React UI (`App.tsx`, страницы, `api.ts`, `i18n.ts`)
- `src-tauri/src/` — Rust: vault, Steam API, команды Tauri
- `scripts/` — сборка, синхронизация версии, staging для CI

Подробнее: [ARCHITECTURE.md](ARCHITECTURE.md).

## Локальные каталоги (не в git)

`node_modules/`, `dist/`, `target/`, `release/` — см. `.gitignore`.

Cargo по умолчанию пишет в корневой `target/` (`.cargo/config.toml`).

## Языки UI

Строки в `src/i18n.ts` (RU / EN). Новые ключи добавляйте в оба блока.

## Мобильная разработка

- Android: `npm run tauri android dev` после [setup-android.md](../scripts/setup-android.md).
- iOS: только на Mac, [setup-ios.md](../scripts/setup-ios.md).
