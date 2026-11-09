const SCHEME_PREFIX = "customsda://import";

export type TransferEnvelopePreview = {
  accountName?: string;
  steamId?: string;
};

export function buildTransferDeepLink(qrPayload: string, qrUrl?: string): string {
  if (qrUrl) {
    return qrUrl;
  }
  return `${SCHEME_PREFIX}?d=${encodeURIComponent(qrPayload)}`;
}

function payloadFromRaw(data: string): string | null {
  const trimmed = data.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const v = JSON.parse(trimmed) as { v?: number; ciphertext?: string };
    if (typeof v.v === "number" && typeof v.ciphertext === "string") {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

function queryParamD(url: string): string | null {
  const match = url.match(/[?&]d=([^#&]*)/i);
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1].replace(/\+/g, "%20"));
  } catch {
    return match[1];
  }
}

export function parseTransferPayloadFromUrl(url: string): string | null {
  const trimmed = url.trim();
  const raw = payloadFromRaw(trimmed);
  if (raw) {
    return raw;
  }

  if (trimmed.startsWith("customsda:")) {
    const data = queryParamD(trimmed);
    if (data) {
      return payloadFromRaw(data) ?? data;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "customsda:") {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/^\//, "").toLowerCase();
    if (host !== "import" && path !== "import" && host !== "") {
      return null;
    }
    const data = parsed.searchParams.get("d");
    if (!data) {
      return null;
    }
    return payloadFromRaw(data) ?? data;
  } catch {
    return null;
  }
}

export function previewTransferEnvelope(qrPayload: string): TransferEnvelopePreview | null {
  try {
    const v = JSON.parse(qrPayload) as {
      accountName?: string;
      account_name?: string;
      steamId?: string;
      steam_id?: string;
    };
    return {
      accountName: v.accountName ?? v.account_name,
      steamId: v.steamId ?? v.steam_id,
    };
  } catch {
    return null;
  }
}

export const PENDING_TRANSFER_STORAGE_KEY = "custom-sda-pending-transfer";
