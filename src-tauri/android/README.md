# Android sideload signing

Release APKs are signed with **`sideload.keystore`** in this folder so **every build (local and CI) uses the same key**. That lets Android install a new APK **on top** of the old one without uninstalling — your encrypted vault in app storage is kept.

Release builds also enable **`hasFragileUserData`**: when uninstalling, Android can offer to **keep app data**. After reinstalling the same signed APK, open the app and **unlock with your vault password** (or wipe and start fresh). For another device or a manual backup, use **Settings → Export vault** (`.csda` file).

| Field | Value |
|-------|--------|
| Keystore | `sideload.keystore` |
| Alias | `customsda` |
| Password | `custom-sda-sideload` (public by design for sideload) |

**Do not** use this keystore for Google Play production if you later publish there — create a separate release keystore.

If you ever installed an APK signed with another key (old debug keystore, `tauri android dev` build), Android will reject an update. Uninstall once, then use only release APKs from this repo / GitHub Releases.
