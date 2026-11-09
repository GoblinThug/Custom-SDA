# iOS setup for Custom SDA (Tauri 2)

**Important:** iOS builds run **only on macOS**. From Windows you can use [GitHub Actions](#github-actions-from-windows) or a Mac with the steps below.

## Mac: requirements

- macOS 12+
- **Xcode** (full app from App Store, not only Command Line Tools)
- [Homebrew](https://brew.sh/) (recommended)
- Node.js 20+
- Rust (rustup)

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

## Build

Simulator (no Apple Developer account):

```bash
npm run build:ios
# same as: bash scripts/build-ios.sh -- --target aarch64-sim
```

Physical device / IPA (signing in Xcode or env vars):

```bash
npm run build:ios:device
```

Open Xcode project for signing:

```bash
npm run tauri ios build -- --open
```

Set **Team** and bundle ID `com.customsda.desktop` (or change in `src-tauri/tauri.conf.json`).

Deep link scheme `customsda://` is configured in `tauri.conf.json` (plugin deep-link).

## GitHub Actions (from Windows)

1. Create a Git repository and push the project to GitHub.
2. Open **Actions** → **Build iOS** → **Run workflow**.
3. Download the artifact `custom-sda-ios-*` (simulator `.app`).

Signing for TestFlight/App Store requires secrets (`APPLE_CERTIFICATE`, provisioning profile, etc.) — not configured in the default workflow.

## Troubleshooting

- After upgrading Tauri: `rm -rf src-tauri/gen/apple && npm run tauri ios init -- --ci`
- Pod errors: `cd src-tauri/gen/apple && pod repo update && pod install`
- Icons: `npm run icon:all` (includes `.icns` for Apple targets)
