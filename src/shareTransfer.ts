/** Share transfer deep link + optional QR PNG via the system share sheet. */

const ANDROID_PACKAGE = "com.customsda.desktop";

function dataUrlToFile(dataUrl: string, filename: string): File | null {
  try {
    const [header, raw] = dataUrl.split(",", 2);
    if (!raw) {
      return null;
    }
    const mime = /data:([^;]+)/.exec(header)?.[1] ?? "image/png";
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}

/** customsda://import?d=… → intent://… for Telegram / Chrome on Android */
export function buildAndroidIntentLink(qrUrl: string): string {
  if (!qrUrl.startsWith("customsda://")) {
    return qrUrl;
  }
  const pathAndQuery = qrUrl.slice("customsda://".length);
  return `intent://${pathAndQuery}#Intent;scheme=customsda;package=${ANDROID_PACKAGE};end`;
}

export function pickShareableAppLink(qrUrl: string): string {
  if (
    typeof navigator !== "undefined" &&
    /android/i.test(navigator.userAgent)
  ) {
    return buildAndroidIntentLink(qrUrl);
  }
  return qrUrl;
}

export type ShareTransferInput = {
  qrDataUrl: string;
  qrUrl: string;
  code: string;
  accountName: string;
  title: string;
  text: string;
};

export type ShareLinkInput = {
  qrUrl: string;
  code: string;
  title: string;
  /** Full text for clipboard / Telegram message */
  message: string;
  /** Link passed in Web Share `url` when supported */
  shareUrl: string;
};

export type ShareTransferResult = "shared" | "copied" | "cancelled" | "unavailable";

export async function shareTransferLink(
  input: ShareLinkInput,
): Promise<ShareTransferResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const payload: ShareData = {
        title: input.title,
        text: input.message,
      };
      if (typeof navigator.canShare === "function" && navigator.canShare({ url: input.shareUrl })) {
        payload.url = input.shareUrl;
      }
      await navigator.share(payload);
      return "shared";
    } catch (err) {
      const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
      if (name === "AbortError") {
        return "cancelled";
      }
    }
  }

  try {
    await navigator.clipboard.writeText(input.message);
    return "copied";
  } catch {
    return "unavailable";
  }
}

export async function shareTransferQr(
  input: ShareTransferInput,
): Promise<ShareTransferResult> {
  const file = dataUrlToFile(input.qrDataUrl, `custom-sda-${input.accountName || "transfer"}.png`);
  const text = input.text;

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      if (
        file &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: input.title,
          text,
        });
        return "shared";
      }
      await navigator.share({
        title: input.title,
        text: `${text}\n\n${input.qrUrl}`,
      });
      return "shared";
    } catch (err) {
      const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
      if (name === "AbortError") {
        return "cancelled";
      }
      /* fall through to clipboard */
    }
  }

  try {
    await navigator.clipboard.writeText(`${input.qrUrl}\n${text}`);
    return "copied";
  } catch {
    return "unavailable";
  }
}
