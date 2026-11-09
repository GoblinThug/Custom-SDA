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

  async function fileToScanBlob(file: File): Promise<Blob> {
    // Huge phone photos confuse html5-qrcode — downscale for detection.
    if (file.size < 400_000) {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      if (scale >= 0.98) {
        bitmap.close();
        return file;
      }
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close();
        return file;
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
      );
      return blob ?? file;
    } catch {
      return file;
    }
  }

  async function decodeImage(file: File) {
    setBusy(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(`qr-file-${mountId}`);
      const scanBlob = await fileToScanBlob(file);
      const scanFile =
        scanBlob instanceof File
          ? scanBlob
          : new File([scanBlob], "scan.jpg", { type: scanBlob.type || "image/jpeg" });

      let decoded: string | null = null;
      try {
        decoded = await scanner.scanFile(scanFile, false);
      } catch {
        try {
          decoded = await scanner.scanFile(scanFile, true);
        } catch {
          decoded = null;
        }
      } finally {
        try {
          scanner.clear();
        } catch {
          /* ignore */
        }
      }

      if (!decoded) {
        onError(t(lang, "mobileScannerInvalid"));
        return;
      }
      const payload = parseTransferPayloadFromUrl(decoded);
      if (!payload) {
        onError(t(lang, "mobileScannerInvalid"));
        return;
      }
      onPayload(payload);
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
    <div className="mobile-scanner-screen">
      <div className="mobile-qr-scanner stack">
        <h1 className="page-title">{t(lang, "mobileScannerTitle")}</h1>
        <p className="muted page-lead">{t(lang, "mobileScannerLead")}</p>

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
