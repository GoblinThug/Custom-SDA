import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { api } from "./api";
import { isMobileHost } from "./platform";

const VAULT_BACKUP_FILTER = {
  name: "Custom SDA vault",
  extensions: ["csda", "json"],
};

/** Android maps `extensions` to MIME types; `.csda` has no mapping and breaks the picker. */
const MOBILE_VAULT_IMPORT_FILTER = {
  name: VAULT_BACKUP_FILTER.name,
  extensions: ["application/json", "text/plain", "application/octet-stream"],
};

export async function pickVaultBackupFile(): Promise<string | null> {
  const path = await open(
    isMobileHost()
      ? {
          multiple: false,
          pickerMode: "document",
          filters: [MOBILE_VAULT_IMPORT_FILTER],
        }
      : {
          multiple: false,
          filters: [VAULT_BACKUP_FILTER],
        },
  );
  if (!path || Array.isArray(path)) {
    return null;
  }
  return path;
}

export async function pickVaultBackupSavePath(): Promise<string | null> {
  const path = await save({
    filters: [{ name: VAULT_BACKUP_FILTER.name, extensions: ["csda"] }],
    defaultPath: "custom-sda-vault-backup.csda",
  });
  if (!path) {
    return null;
  }
  return path;
}

/** Export vault to a user-picked path (FS plugin on mobile, native copy on desktop). */
export async function exportVaultToPickedPath(): Promise<boolean> {
  const path = await pickVaultBackupSavePath();
  if (!path) {
    return false;
  }
  if (isMobileHost()) {
    const contents = await api.vaultExportContents();
    await writeTextFile(path, contents);
  } else {
    await api.vaultExport(path);
  }
  return true;
}

/** Import vault from a user-picked backup file. */
export async function importVaultFromPickedPath(password: string, sourcePath?: string) {
  const path = sourcePath ?? (await pickVaultBackupFile());
  if (!path) {
    return null;
  }
  if (isMobileHost()) {
    const contents = await readTextFile(path);
    return api.vaultImportContents(contents, password);
  }
  return api.vaultImport(path, password);
}
