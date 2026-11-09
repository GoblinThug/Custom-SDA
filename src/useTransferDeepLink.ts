import { listen } from "@tauri-apps/api/event";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { useEffect } from "react";
import { parseTransferPayloadFromUrl } from "./transferDeepLink";

export function useTransferDeepLink(onPayload: (qrPayload: string) => void) {
  useEffect(() => {
    let cancelled = false;
    let unlistenOpen: (() => void) | undefined;
    let unlistenEvent: (() => void) | undefined;

    const handleUrls = (urls: string[]) => {
      for (const url of urls) {
        const payload = parseTransferPayloadFromUrl(url);
        if (payload) {
          onPayload(payload);
          return;
        }
      }
    };

  const pollStartUrl = async () => {
    for (const delay of [0, 300, 800, 1500, 3000]) {
      if (cancelled) {
        return;
      }
      if (delay > 0) {
        await new Promise((r) => window.setTimeout(r, delay));
      }
      try {
        const current = await getCurrent();
        if (current?.length) {
          handleUrls(current);
          return;
        }
      } catch {
        /* plugin not ready */
      }
    }
  };

    void (async () => {
      try {
        unlistenOpen = await onOpenUrl(handleUrls);
      } catch {
        /* unsupported */
      }

      try {
        unlistenEvent = await listen<string | string[]>("deep-link://new-url", (event) => {
          const payload = event.payload;
          if (Array.isArray(payload)) {
            handleUrls(payload);
          } else if (typeof payload === "string") {
            handleUrls([payload]);
          }
        });
      } catch {
        /* event not available */
      }

      await pollStartUrl();
    })();

    return () => {
      cancelled = true;
      unlistenOpen?.();
      unlistenEvent?.();
    };
  }, [onPayload]);
}
