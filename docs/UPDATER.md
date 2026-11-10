# Updates via GitHub Releases (no signing keys)

Desktop apps check the public GitHub API:

`GET https://api.github.com/repos/GoblinThug/Custom-SDA/releases/latest`

No `TAURI_SIGNING_*` secrets, no `latest.json`, no private keys.

## Behaviour

1. Compare release tag (e.g. `v0.0.2`) with the built-in app version.
2. If newer → offer update.
3. Open the matching installer URL (`.exe` / `.AppImage` / `.dmg`) or the release page in the browser.
4. User installs manually (same pattern as many apps that “update from GitHub” without a signed silent updater).

## Why not Tauri’s built-in updater?

The official Tauri updater **requires** a minisign keypair to verify packages. That is by design (anti-tamper). Apps that update “without keys” usually only open a download link from Releases — they do not silently replace the binary with signature checks.

## Release flow

1. Bump `version` in `package.json` only, then run `npm run sync:version` (or rely on `prebuild` / CI).
2. Push to `main` → CI builds and publishes GitHub Release assets.
3. Installed apps see the new tag on **Check for updates** (footer).

Repository default: `GoblinThug/Custom-SDA`. Tag format: `v1.0.0` matching `package.json` (synced by `npm run sync:version`).
