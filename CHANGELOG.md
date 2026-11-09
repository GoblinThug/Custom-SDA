# Changelog

## Unreleased

### Performance
- Faster account switching (no full vault refresh / Steam avatar fetch on each click).
- `accounts_list` fetches missing avatars only when requested; background refresh after unlock.
- Shorter Steam avatar HTTP timeout.

### Security
- Biometric unlock uses keystore cipher only (legacy plaintext gate mode removed).
- Vault password verified before enabling biometrics in Settings.
- Removed unused `encryption_status` IPC.

### Features
- Auto-lock respects **Settings → Security → Auto-lock** (`lock_timeout_secs`).
- App version read from `package.json` (`src/version.ts`).

### Cleanup
- Removed dead IPC and unused i18n strings.
- GitHub Release updates (no signing keys) documented in `docs/UPDATER.md`.
