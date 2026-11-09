/** Share transfer deep link + optional QR PNG via the system share sheet. */

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

export type ShareTransferInput = {
  qrDataUrl: string;
  qrUrl: string;
  code: string;
  accountName: string;
  title: string;
  text: string;
};

export type ShareTransferResult = "shared" | "copied" | "cancelled" | "unavailable";

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
        text,
        url: input.qrUrl,
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
