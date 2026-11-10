# Changelog

Формат: версии по [SemVer](https://semver.org/). Актуальный номер релиза = `package.json` (секции ниже — история; новую версию добавляйте вручную при релизе).

## Unreleased

_(пусто)_

## 0.0.5

### Features
- Подтверждения Steam: список, accept/deny, повторный вход (`steam_session_*`) и импорт maFile с экрана подтверждений.
- Единая синхронизация версии: `package.json` → Tauri / Cargo (`scripts/sync-version.mjs`).
- Журнал событий: все записи (до 50) со скроллом; единый значок успеха/ошибки.
- UI подтверждений: переключатель аккаунта как на главной, копирование Guard-кода, панель действий под текстом.

### Fixes
- Desktop: пустой vault больше не зависает на «Загрузка…» без экрана разблокировки.
- Android: инициализация `tauri_plugin_biometric` в `lib.rs`.

### CI / build
- Объединённый macOS job (dmg + iOS sim), кэш Rust для Android, `build-apk.ps1` и NDK.

## 0.0.4 и ранее

См. коммиты и предыдущие записи в Unreleased (до реорганизации changelog).

### Performance (0.0.3 era)
- Faster account switching; фоновое обновление аватаров.

### Security (0.0.3 era)
- Biometric unlock via keystore cipher only; проверка пароля перед включением биометрии.

### Features (0.0.3 era)
- Auto-lock из настроек; версия из `package.json` в UI.
