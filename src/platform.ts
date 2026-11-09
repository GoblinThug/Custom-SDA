import { type as osType } from "@tauri-apps/plugin-os";

function uaLooksMobile(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** True on Tauri Android/iOS (with UA fallback if the OS plugin is unavailable). */
export function isMobileHost(): boolean {
  if (uaLooksMobile()) {
    return true;
  }
  try {
    const kind = osType();
    return kind === "android" || kind === "ios";
  } catch {
    return false;
  }
}
