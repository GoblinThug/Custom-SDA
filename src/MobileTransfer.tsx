import { buildBrandedQrDataUrl } from "./buildBrandedQr";
import { useCallback, useEffect, useState } from "react";
import { Account, api, MobileTransfer } from "./api";
import { Lang, localizeErrorMessage, t } from "./i18n";
import { isMobileHost } from "./platform";
import { shareTransferQr } from "./shareTransfer";
import { showToast } from "./toast";
import { SelectMenu } from "./SelectMenu";

export function MobileTransferPage({
  lang,
  accounts,
  onError,
}: {
  lang: Lang;
  accounts: Account[];
  onError: (msg: string | null) => void;
}) {
  const [steamId, setSteamId] = useState(
    () => accounts.find((a) => a.selected)?.steam_id ?? accounts[0]?.steam_id ?? "",
  );
  const [transfer, setTransfer] = useState<MobileTransfer | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const selected = accounts.find((a) => a.selected)?.steam_id;
    if (selected && !steamId) {
      setSteamId(selected);
    }
  }, [accounts, steamId]);

  useEffect(() => {
    if (!transfer) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [transfer]);

  const expiresIn = transfer
    ? Math.max(
        0,
        transfer.expiresInSecs -
          Math.floor((now - transfer.createdAt) / 1000),
      )
    : 0;

  const buildQr = useCallback(
    async (payload: string) => {
      try {
        setQrDataUrl(await buildBrandedQrDataUrl(payload));
      } catch {
        throw new Error(t(lang, "errMobileTransferQrTooBig"));
      }
    },
    [lang],
  );

  async function createTransfer() {
    onError(null);
    setBusy(true);
    try {
      const next = await api.mobileTransferPrepare(steamId || undefined);
      setTransfer({ ...next, createdAt: Date.now() });
      setConfirmCode("");
      await buildQr(next.qrPayload);
    } catch (e) {
      onError(localizeErrorMessage(String(e), lang));
      setTransfer(null);
      setQrDataUrl(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmOnThisDevice() {
    if (!transfer) return;
    onError(null);
    try {
      await api.mobileTransferConfirmCode(confirmCode);
      showToast(t(lang, "mobileTransferCodeOk"), "success");
    } catch (e) {
      onError(localizeErrorMessage(String(e), lang));
    }
  }

  async function shareQr() {
    if (!transfer || !qrDataUrl) {
      return;
    }
    setShareBusy(true);
    try {
      const result = await shareTransferQr({
        qrDataUrl,
        qrUrl: transfer.qrUrl,
        code: transfer.code,
        accountName: transfer.accountName,
        title: t(lang, "mobileTransferShare"),
        text: `${t(lang, "mobileTransferShareText")}: ${transfer.code}`,
      });
      if (result === "shared") {
        showToast(t(lang, "mobileTransferShareOk"), "success");
      } else if (result === "copied") {
        showToast(t(lang, "mobileTransferShareCopied"), "success");
      } else if (result === "unavailable") {
        onError(t(lang, "mobileTransferShareFail"));
      }
    } finally {
      setShareBusy(false);
    }
  }

  const accountOptions = accounts.map((a) => ({
    value: a.steam_id,
    label: a.account_name,
  }));

  return (
    <div className="panel">
      <h2 className="page-title">{t(lang, "mobileTransferTitle")}</h2>
      <p className="muted page-lead">{t(lang, "mobileTransferLead")}</p>

      {accounts.length === 0 ? (
        <div className="empty">{t(lang, "noAccountsYet")}</div>
      ) : (
        <div className="surface-card stack">
          <SelectMenu
            label={t(lang, "mobileTransferAccount")}
            value={steamId}
            options={accountOptions}
            onChange={setSteamId}
            disabled={busy || !!transfer}
          />
          <button
            type="button"
            className="primary-btn"
            disabled={busy || !steamId}
            onClick={() => {
              void createTransfer();
            }}
          >
            {busy ? t(lang, "loading") : t(lang, "mobileTransferCreate")}
          </button>
        </div>
      )}

      {transfer && qrDataUrl && (
        <div className="surface-card mobile-transfer-qr-card stack">
          <h3 className="inline-section-title">{t(lang, "mobileTransferQr")}</h3>
          <p className="muted card-hint">{t(lang, "mobileTransferQrHint")}</p>
          <div className="qr-wrap">
            <img className="qr-image" src={qrDataUrl} alt="" />
          </div>
          <button
            type="button"
            className="primary-btn"
            disabled={shareBusy || expiresIn <= 0}
            onClick={() => {
              void shareQr();
            }}
          >
            {shareBusy ? t(lang, "loading") : t(lang, "mobileTransferShare")}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              void navigator.clipboard.writeText(transfer.qrUrl).then(() => {
                showToast(t(lang, "mobileTransferDeepLinkCopied"), "success");
              });
            }}
          >
            {t(lang, "mobileTransferCopyDeepLink")}
          </button>
          <div className="pair-code-block">
            <div className="label">{t(lang, "mobileTransferCodeLabel")}</div>
            <div className="pair-code-digits" aria-live="polite">
              {transfer.code}
            </div>
            <p className="muted card-hint">{t(lang, "mobileTransferCodeHint")}</p>
          </div>
          {expiresIn <= 0 ? (
            <p className="error-inline">{t(lang, "mobileTransferExpired")}</p>
          ) : (
            <p className="muted">
              {t(lang, "mobileTransferExpires")}: {expiresIn}s
            </p>
          )}
          {!isMobileHost() && (
            <>
              <div>
                <div className="label">{t(lang, "mobileTransferConfirmDesktop")}</div>
                <input
                  className="field"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmCode}
                  onChange={(e) =>
                    setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                />
              </div>
              <button
                type="button"
                className="ghost-btn"
                disabled={confirmCode.length !== 6}
                onClick={() => {
                  void confirmOnThisDevice();
                }}
              >
                {t(lang, "mobileTransferConfirmBtn")}
              </button>
            </>
          )}
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setTransfer(null);
              setQrDataUrl(null);
              setConfirmCode("");
            }}
          >
            {t(lang, "cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
