import { open, save } from "@tauri-apps/plugin-dialog";

const VAULT_BACKUP_FILTER = {
  name: "Custom SDA vault",
  extensions: ["csda", "json"],
};

export async function pickVaultBackupFile(): Promise<string | null> {
  const path = await open({
    multiple: false,
    filters: [VAULT_BACKUP_FILTER],
  });
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
