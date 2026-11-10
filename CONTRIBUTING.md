# Contributing

Спасибо за интерес к Custom SDA. Проект частный/личный, но патчи и идеи приветствуются через Issues и Pull Requests на [GitHub](https://github.com/GoblinThug/Custom-SDA).

## Перед началом

1. Прочитайте [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
2. Убедитесь, что `npx tsc --noEmit` и `cargo check` в `src-tauri/` проходят.
3. Не добавляйте секреты, maFile, ключи подписи в коммиты.

## Версия

Одна правка в `package.json` → `version`, затем:

```bash
npm run sync:version
```

Коммитьте вместе с `package.json`: `tauri.conf.json`, `Cargo.toml`, `Cargo.lock` и затронутые `.md` (версия в README / CI-PIPELINE / docs).

## Стиль кода

- TypeScript / React: существующий стиль файла (hooks, `api.ts` для IPC).
- Rust: `cargo fmt`, осмысленные ошибки `String` / `Result` как в `commands.rs`.
- UI-строки: ключи в `src/i18n.ts` (RU + EN).

## Changelog

Для заметных изменений добавьте пункт в [CHANGELOG.md](CHANGELOG.md) под `Unreleased` или в секцию версии.

## CI

Push в `main` запускает полную сборку и GitHub Release. См. [.github/CI-PIPELINE.md](.github/CI-PIPELINE.md).

## Безопасность

Уязвимости лучше сообщать через private issue или контакт maintainer — не публикуйте эксплойты с реальными секретами.
