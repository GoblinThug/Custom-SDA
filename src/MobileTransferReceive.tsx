import { useEffect, useMemo, useState } from "react";
import { Account, api } from "./api";
import { Lang, localizeErrorMessage, t } from "./i18n";
import { showToast } from "./toast";
import { previewTransferEnvelope } from "./transferDeepLink";

export function MobileTransferReceive({
  lang,
  qrPayload,
  accounts,
  onImported,
  onError,
  onClear,
  onOpenScanner,
}: {
  lang: Lang;
  qrPayload: string | null;
  accounts: Account[];
  onImported: () => void;
  onError: (msg: string | null) => void;
  onClear: () => void;
  onOpenScanner?: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = useMemo(
    () => (qrPayload ? previewTransferEnvelope(qrPayload) : null),
    [qrPayload],
  );

  useEffect(() => {
    if (qrPayload) {
      showToast(t(lang, "mobileTransferReceiveActiveLead"), "success");
    }
  }, [qrPayload, lang]);

  async function importAccount() {
    if (!qrPayload || code.length !== 6) {
      return;
    }
    onError(null);
    setBusy(true);
    try {
      await api.mobileTransferImport(qrPayload, code);
      showToast(t(lang, "mobileTransferImportOk"), "success");
      setCode("");
      onClear();
      onImported();
    } catch (e) {
      onError(localizeErrorMessage(String(e), lang));
    } finally {
      setBusy(false);
    }
  }

  if (!qrPayload) {
    return (
      <div className="panel">
        <h2 className="page-title">{t(lang, "mobileTransferReceiveTitle")}</h2>
        <p className="muted page-lead">{t(lang, "mobileTransferReceiveLead")}</p>
        <div className="surface-card stack">
          {onOpenScanner && (
            <button type="button" className="primary-btn" onClick={onOpenScanner}>
              {t(lang, "mobileScannerOpen")}
            </button>
          )}
          {accounts.length > 0 ? (
            <p className="muted card-hint">{t(lang, "mobileTransferReceiveIdleHint")}</p>
          ) : (
            <p className="muted card-hint">{t(lang, "mobileTransferReceiveWaiting")}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="page-title">{t(lang, "mobileTransferReceiveTitle")}</h2>
      <p className="muted page-lead">{t(lang, "mobileTransferReceiveActiveLead")}</p>
      <div className="surface-card stack">
        <div className="label">{t(lang, "mobileTransferAccount")}</div>
        <p className="account-name">
          {preview?.accountName ?? t(lang, "mobileTransferUnknownAccount")}
        </p>
        <p className="muted card-hint">{t(lang, "mobileTransferReceiveCodeHint")}</p>
        <input
          className="field"
          inputMode="numeric"
          maxLength={6}
          value={code}
          autoFocus
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
        />
        <button
          type="button"
          className="primary-btn"
          disabled={busy || code.length !== 6}
          onClick={() => {
            void importAccount();
          }}
        >
          {busy ? t(lang, "loading") : t(lang, "mobileTransferImportBtn")}
        </button>
        <button type="button" className="ghost-btn" disabled={busy} onClick={onClear}>
          {t(lang, "cancel")}
        </button>
      </div>
    </div>
  );
}
