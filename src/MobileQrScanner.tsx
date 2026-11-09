import { ChangeEvent, useId, useRef, useState } from "react";
import { Lang, t } from "./i18n";
import { parseTransferPayloadFromUrl } from "./transferDeepLink";

/** Decode a QR from a photo taken with the system camera or picked from gallery. */
export function MobileQrScanner({
  lang,
  onPayload,
  onBack,
  onError,
}: {
  lang: Lang;
  onPayload: (payload: string) => void;
  onBack: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mountId = useId().replace(/:/g, "");

  async function decodeImage(file: File) {
    setBusy(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(`qr-file-${mountId}`);
      try {
        const decoded = await scanner.scanFile(file, false);
        const payload = parseTransferPayloadFromUrl(decoded);
        if (!payload) {
          onError(t(lang, "mobileScannerInvalid"));
          return;
        }
        onPayload(payload);
      } finally {
        try {
          scanner.clear();
        } catch {
          /* ignore */
        }
      }
    } catch {
      onError(t(lang, "mobileScannerInvalid"));
    } finally {
      setBusy(false);
    }
  }

  function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      void decodeImage(file);
    }
  }

  return (
    <div className="auth-screen mobile-scanner-screen">
      <div className="auth-card mobile-qr-scanner stack">
        <h1 className="page-title">{t(lang, "mobileScannerTitle")}</h1>
        <p className="muted page-lead">{t(lang, "mobileScannerLead")}</p>

        {/* Hidden mount required by html5-qrcode scanFile */}
        <div id={`qr-file-${mountId}`} className="visually-hidden" aria-hidden />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          onChange={onFilePicked}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={onFilePicked}
        />

        <button
          type="button"
          className="primary-btn"
          disabled={busy}
          onClick={() => cameraInputRef.current?.click()}
        >
          {busy ? t(lang, "loading") : t(lang, "mobileScannerTakePhoto")}
        </button>
        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          onClick={() => galleryInputRef.current?.click()}
        >
          {t(lang, "mobileScannerFromPhoto")}
        </button>
        <button type="button" className="ghost-btn" disabled={busy} onClick={onBack}>
          {t(lang, "mobileSetupBack")}
        </button>
      </div>
    </div>
  );
}
