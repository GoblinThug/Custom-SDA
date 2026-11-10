# iOS setup for Custom SDA (Tauri 2)

**Important:** iOS builds run **only on macOS**. From Windows use **GitHub Actions** or a remote Mac — see [.github/CI-PIPELINE.md](../.github/CI-PIPELINE.md).

## Mac: requirements

- macOS 12+
- **Xcode** (full app from App Store)
- [Homebrew](https://brew.sh/) (recommended)
- Node.js 20+
- Rust 1.90+ (rustup)

```bash
xcode-select --install   # if needed
brew install cocoapods
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
```

## First-time init

```bash
npm install
npm run tauri ios init -- --ci
cd src-tauri/gen/apple && pod install && cd ../../..
```

`src-tauri/gen/apple/` в `.gitignore` — на CI каталог создаётся заново.

## Build

**Simulator** (no Apple Developer account):

```bash
npm run build:ios
# bash scripts/build-ios.sh -- --target aarch64-sim
```

**Physical device / IPA** (signing in Xcode):

```bash
npm run build:ios:device
```

Open project for Team / bundle ID:

```bash
npm run tauri ios build -- --open
```

Bundle ID по умолчанию: `com.customsda.desktop` (`src-tauri/tauri.conf.json`).

Deep link: scheme `customsda://` (plugin `deep-link`).

## Windows → CI

1. Push to GitHub `main` or run **Build release (all platforms)**.
2. **macOS** job: `.dmg` в Release; iOS simulator `.app` в **Artifacts** (`custom-sda-ios-simulator`).

TestFlight / App Store need Apple signing secrets — not in default workflow.

## Troubleshooting

| Проблема | Действие |
|----------|----------|
| Stale gen after Tauri upgrade | `rm -rf src-tauri/gen/apple && npm run tauri ios init -- --ci` |
| CocoaPods | `cd src-tauri/gen/apple && pod repo update && pod install` |
| Icons | `npm run icon:all` |

См. также [docs/README.md](../docs/README.md).
