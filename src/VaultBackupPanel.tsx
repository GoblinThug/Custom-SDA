import { FormEvent, useState } from "react";
import { IconImport } from "./icons";
import { Lang, t } from "./i18n";
import { VaultStatus, api } from "./api";
import { pickVaultBackupFile } from "./vaultBackup";
import { notifyError, showToast } from "./toast";

type PasswordFieldProps = {
  value: string;
  onChange: (v: string) => void;
  lang: Lang;
  autoFocus?: boolean;
};

function VaultBackupPasswordField({
  value,
  onChange,
  lang,
  autoFocus,
}: PasswordFieldProps) {
  return (
    <input
      className="field"
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus={autoFocus}
      autoComplete="current-password"
      placeholder={t(lang, "password")}
    />
  );
}

export function VaultBackupPanel({
  lang,
  variant,
  onSuccess,
  onBack,
}: {
  lang: Lang;
  variant: "setup" | "settings";
  onSuccess: (status: VaultStatus) => void;
  onBack?: () => void;
}) {
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function pickFile() {
    try {
      const path = await pickVaultBackupFile();
      if (path) {
        setBackupPath(path);
      }
    } catch (e) {
      notifyError(String(e));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!backupPath) {
      notifyError(t(lang, "vaultBackupPickFirst"));
      return;
    }
    if (password.length < 6) {
      notifyError(t(lang, "passwordMin6"));
      return;
    }
    setBusy(true);
    try {
      const next = await api.vaultImport(backupPath, password);
      showToast(t(lang, "vaultImportOk"), "success");
      onSuccess(next);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const card = (
    <form className={variant === "setup" ? "auth-card" : "stack"} onSubmit={submit} noValidate>
      {variant === "setup" && (
        <>
          <div className="auth-heading">
            <h1>{t(lang, "vaultBackupImportTitle")}</h1>
          </div>
          <p className="muted">{t(lang, "vaultBackupImportLead")}</p>
        </>
      )}
      <div>
        <div className="label">{t(lang, "vaultBackupFile")}</div>
        <div className="row-actions vault-backup-file-row">
          <input
            className="field vault-backup-path"
            readOnly
            value={backupPath ?? ""}
            placeholder={t(lang, "vaultBackupNoFile")}
          />
          <button type="button" className="ghost-btn" disabled={busy} onClick={() => void pickFile()}>
            <IconImport />
            {t(lang, "vaultBackupPick")}
          </button>
        </div>
      </div>
      <div>
        <div className="label">{t(lang, "vaultBackupPasswordLabel")}</div>
        <VaultBackupPasswordField
          value={password}
          onChange={setPassword}
          lang={lang}
          autoFocus={variant === "setup"}
        />
      </div>
      <button className="primary-btn" type="submit" disabled={busy || !backupPath}>
        {busy ? "…" : t(lang, "vaultBackupImportBtn")}
      </button>
      {variant === "setup" && onBack && (
        <button type="button" className="ghost-btn" disabled={busy} onClick={onBack}>
          {t(lang, "back")}
        </button>
      )}
    </form>
  );

  if (variant === "setup") {
    return <div className="auth-screen">{card}</div>;
  }
  return card;
}
