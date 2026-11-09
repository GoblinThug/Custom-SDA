import QRCode from "qrcode";

const LOGO_SRC = "/icon.png";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("logo load failed"));
    img.src = src;
  });
}

async function overlayLogo(qrDataUrl: string, size: number, logoRatio: number): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return qrDataUrl;
  }

  const qrImg = await loadImage(qrDataUrl);
  const logoImg = await loadImage(LOGO_SRC);

  ctx.drawImage(qrImg, 0, 0, size, size);

  const logoSize = Math.round(size * logoRatio);
  const pad = Math.round(logoSize * 0.14);
  const x = Math.round((size - logoSize) / 2);
  const y = Math.round((size - logoSize) / 2);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  const r = Math.round(pad * 0.6);
  const bx = x - pad;
  const by = y - pad;
  const bw = logoSize + pad * 2;
  const bh = logoSize + pad * 2;
  ctx.roundRect(bx, by, bw, bh, r);
  ctx.fill();

  ctx.drawImage(logoImg, x, y, logoSize, logoSize);
  return canvas.toDataURL("image/png");
}

/** Payloads from mobile transfer are near QR capacity — logo only on short URLs. */
const DENSE_QR_LEN = 1000;

/** Large, high-contrast QR with app icon in the center (when ECC allows). */
export async function buildBrandedQrDataUrl(text: string): Promise<string> {
  const size = 440;
  const qrOptions = {
    margin: 4,
    width: size,
    color: { dark: "#101828", light: "#ffffff" },
  };

  const attempts: { level: "L" | "M" | "Q"; logoRatio: number }[] =
    text.length > DENSE_QR_LEN
      ? [
          { level: "L", logoRatio: 0 },
          { level: "M", logoRatio: 0 },
        ]
      : text.length > 500
        ? [
            { level: "M", logoRatio: 0 },
            { level: "L", logoRatio: 0 },
            { level: "M", logoRatio: 0.12 },
          ]
        : [
            { level: "M", logoRatio: 0.12 },
            { level: "L", logoRatio: 0 },
          ];

  for (const { level, logoRatio } of attempts) {
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        ...qrOptions,
        errorCorrectionLevel: level,
      });
      if (logoRatio > 0) {
        return await overlayLogo(dataUrl, size, logoRatio);
      }
      return dataUrl;
    } catch {
      /* try lower ECC */
    }
  }

  throw new Error("The amount of data is too big to be stored in a QR Code");
}
