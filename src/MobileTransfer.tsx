import { buildBrandedQrDataUrl } from "./buildBrandedQr";
import { pickQrEncode } from "./transferDeepLink";
import { useCallback, useEffect, useState } from "react";
import { Account, api, MobileTransfer } from "./api";
import { Lang, localizeErrorMessage, t } from "./i18n";
import { isMobileHost } from "./platform";
import { pickShareableAppLink, shareTransferLink, shareTransferQr } from "./shareTransfer";
import { showToast } from "./toast";
import { SelectMenu } from "./SelectMenu";
import { MobileTransferPhoneSteps } from "./MobileTransferPhoneSteps";

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
  const [busy, setBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareLinkBusy, setShareLinkBusy] = useState(false);
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
    async (payload: string, deepLink: string) => {
      try {
        const text = pickQrEncode(payload, deepLink, isMobileHost());
        setQrDataUrl(
          await buildBrandedQrDataUrl(text, {
            large: true,
            extraLarge: isMobileHost(),
          }),
        );
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
      await buildQr(next.qrPayload, next.qrUrl);
    } catch (e) {
      onError(localizeErrorMessage(String(e), lang));
      setTransfer(null);
      setQrDataUrl(null);
    } finally {
      setBusy(false);
    }
  }

  async function shareAppLink() {
    if (!transfer) {
      return;
    }
    setShareLinkBusy(true);
    try {
      const openLink = pickShareableAppLink(transfer.qrUrl);
      const message = [
        t(lang, "mobileTransferShareLinkIntro"),
        "",
        openLink,
        "",
        `${t(lang, "mobileTransferCodeLabel")}: ${transfer.code}`,
        "",
        t(lang, "mobileTransferShareLinkHint"),
      ].join("\n");
      const result = await shareTransferLink({
        qrUrl: transfer.qrUrl,
        code: transfer.code,
        title: t(lang, "mobileTransferShareLink"),
        message,
        shareUrl: openLink,
      });
      if (result === "shared") {
        showToast(t(lang, "mobileTransferShareLinkOk"), "success");
      } else if (result === "copied") {
        showToast(t(lang, "mobileTransferShareLinkCopied"), "success");
      } else if (result === "unavailable") {
        onError(t(lang, "mobileTransferShareFail"));
      }
    } finally {
      setShareLinkBusy(false);
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
      {isMobileHost() && <MobileTransferPhoneSteps lang={lang} mode="send" />}

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
        <div
          className={`surface-card mobile-transfer-qr-card stack${
            isMobileHost() ? " mobile-transfer-qr-compact" : ""
          }`}
        >
          <h3 className="inline-section-title">{t(lang, "mobileTransferQr")}</h3>
          <p className="muted card-hint">
            {isMobileHost()
              ? t(lang, "mobileTransferQrDisplayHintPhone")
              : t(lang, "mobileTransferQrHint")}
          </p>
          <div className="qr-wrap">
            <img className="qr-image" src={qrDataUrl} alt="" />
          </div>

          <div className="pair-code-block transfer-code-panel">
            <div className="label">{t(lang, "mobileTransferCodeLabel")}</div>
            <div className="pair-code-digits" aria-live="polite">
              {transfer.code}
            </div>
            <p className="muted card-hint">
              {isMobileHost()
                ? t(lang, "mobileTransferCodeHintPhone")
                : t(lang, "mobileTransferCodeHint")}
            </p>
            <button
              type="button"
              className="ghost-btn transfer-code-copy"
              onClick={() => {
                void navigator.clipboard.writeText(transfer.code).then(() => {
                  showToast(t(lang, "mobileTransferCodeCopied"), "success");
                });
              }}
            >
              {t(lang, "mobileTransferCopyCode")}
            </button>
          </div>

          <div className="transfer-share-actions" role="group" aria-label={t(lang, "mobileTransferShareLink")}>
            <button
              type="button"
              className="primary-btn"
              disabled={shareLinkBusy || expiresIn <= 0}
              onClick={() => {
                void shareAppLink();
              }}
            >
              {shareLinkBusy ? t(lang, "loading") : t(lang, "mobileTransferShareLink")}
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={shareBusy || expiresIn <= 0}
              onClick={() => {
                void shareQr();
              }}
            >
              {shareBusy ? t(lang, "loading") : t(lang, "mobileTransferShare")}
            </button>
          </div>

          {expiresIn <= 0 ? (
            <p className="error-inline transfer-meta">{t(lang, "mobileTransferExpired")}</p>
          ) : (
            <p className="muted transfer-meta">
              {t(lang, "mobileTransferExpires")}: {expiresIn}s
            </p>
          )}
          <button
            type="button"
            className="ghost-btn transfer-cancel-btn"
            onClick={() => {
              setTransfer(null);
              setQrDataUrl(null);
            }}
          >
            {t(lang, "cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
