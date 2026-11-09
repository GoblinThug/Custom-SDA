import { useEffect, useMemo, useState } from "react";
import { Account, api } from "./api";
import { Lang, localizeErrorMessage, t } from "./i18n";
import { showToast } from "./toast";
import {
  parseTransferPayloadFromUrl,
  previewTransferEnvelope,
} from "./transferDeepLink";
import { isMobileHost } from "./platform";
import { MobileTransferPhoneSteps } from "./MobileTransferPhoneSteps";

export function MobileTransferReceive({
  lang,
  qrPayload,
  accounts,
  onImported,
  onError,
  onClear,
  onOpenScanner,
  onCapturedPayload,
}: {
  lang: Lang;
  qrPayload: string | null;
  accounts: Account[];
  onImported: () => void;
  onError: (msg: string | null) => void;
  onClear: () => void;
  onOpenScanner?: () => void;
  onCapturedPayload?: (payload: string) => void;
}) {
  const [code, setCode] = useState("");
  const [pasteLink, setPasteLink] = useState("");
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
        {isMobileHost() && <MobileTransferPhoneSteps lang={lang} mode="receive" />}
        <div className="surface-card stack">
          {onOpenScanner && (
            <button type="button" className="primary-btn" onClick={onOpenScanner}>
              {t(lang, "mobileScannerOpen")}
            </button>
          )}
          <p className="muted card-hint">
            {accounts.length > 0
              ? t(lang, "mobileTransferReceiveIdleHint")
              : t(lang, "mobileTransferReceiveWaiting")}
          </p>
          <div className="transfer-alt-block">
            <div className="label">{t(lang, "mobileTransferPasteLink")}</div>
            <textarea
              className="field transfer-paste-field"
              rows={3}
              value={pasteLink}
              placeholder={t(lang, "mobileTransferPastePlaceholder")}
              onChange={(e) => setPasteLink(e.target.value)}
            />
            <button
              type="button"
              className="secondary-btn"
              disabled={!pasteLink.trim()}
              onClick={() => {
                const payload = parseTransferPayloadFromUrl(pasteLink.trim());
                if (!payload) {
                  onError(t(lang, "mobileScannerInvalid"));
                  return;
                }
                onError(null);
                if (onCapturedPayload) {
                  onCapturedPayload(payload);
                  setPasteLink("");
                }
              }}
            >
              {t(lang, "mobileTransferPasteApply")}
            </button>
          </div>
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
