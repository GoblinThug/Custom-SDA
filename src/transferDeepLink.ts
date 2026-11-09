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

/** Accepts v2 (`ciphertext`) and v3 (`c`) envelope JSON. */
function payloadFromRaw(data: string): string | null {
  const trimmed = data.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const v = JSON.parse(trimmed) as {
      v?: number;
      ciphertext?: string;
      c?: string;
      salt?: string;
      s?: string;
    };
    const cipher = v.ciphertext ?? v.c;
    const salt = v.salt ?? v.s;
    if (typeof v.v === "number" && typeof cipher === "string" && typeof salt === "string") {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

/** Decodes `d=` query value: raw JSON, legacy url-encoded JSON, or base64url(JSON). */
export function payloadFromDParam(d: string): string | null {
  const trimmed = d.trim();
  const direct = payloadFromRaw(trimmed);
  if (direct) {
    return direct;
  }
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed.replace(/\+/g, "%20"));
  } catch {
    decoded = trimmed;
  }
  const legacy = payloadFromRaw(decoded);
  if (legacy) {
    return legacy;
  }
  try {
    let b64 = decoded.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) {
      b64 += "=".repeat(4 - pad);
    }
    const json = atob(b64);
    return payloadFromRaw(json);
  } catch {
    return null;
  }
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

/**
 * Extract transfer envelope JSON from:
 * - raw envelope JSON (v2/v3)
 * - customsda://import?d=…
 * - intent://… (Android share)
 * - free text that contains a customsda link
 */
export function parseTransferPayloadFromUrl(url: string): string | null {
  const trimmed = url.trim();
  const raw = payloadFromRaw(trimmed);
  if (raw) {
    return raw;
  }

  // Android intent://import?d=…#Intent;scheme=customsda;…
  if (trimmed.startsWith("intent:")) {
    const d = queryParamD(trimmed);
    if (d) {
      const fromIntent = payloadFromDParam(d);
      if (fromIntent) {
        return fromIntent;
      }
    }
  }

  if (trimmed.startsWith("customsda:")) {
    const data = queryParamD(trimmed);
    if (data) {
      return payloadFromDParam(data);
    }
  }

  // Message may contain the link among other text
  const embedded = trimmed.match(/customsda:\/\/[^\s]+/i)?.[0];
  if (embedded) {
    const data = queryParamD(embedded);
    if (data) {
      const fromEmbed = payloadFromDParam(data);
      if (fromEmbed) {
        return fromEmbed;
      }
    }
  }

  const intentEmbed = trimmed.match(/intent:\/\/[^\s]+/i)?.[0];
  if (intentEmbed) {
    const data = queryParamD(intentEmbed);
    if (data) {
      const fromEmbed = payloadFromDParam(data);
      if (fromEmbed) {
        return fromEmbed;
      }
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
    return payloadFromDParam(data);
  } catch {
    return null;
  }
}

export function previewTransferEnvelope(qrPayload: string): TransferEnvelopePreview | null {
  try {
    const v = JSON.parse(qrPayload) as {
      accountName?: string;
      account_name?: string;
      a?: string;
      steamId?: string;
      steam_id?: string;
      i?: string;
    };
    return {
      accountName: v.accountName ?? v.account_name ?? v.a,
      steamId: v.steamId ?? v.steam_id ?? v.i,
    };
  } catch {
    return null;
  }
}

export const PENDING_TRANSFER_STORAGE_KEY = "custom-sda-pending-transfer";

/** QR always encodes compact envelope JSON (not the longer deep link). */
export function pickQrEncode(payload: string, _deepLink: string, _mobile = false): string {
  return payload;
}
