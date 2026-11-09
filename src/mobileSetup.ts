export type MobileSetupMode = "qr" | "fresh";

const STORAGE_KEY = "custom-sda-mobile-setup-mode";

export function loadMobileSetupMode(): MobileSetupMode | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "qr" || v === "fresh") {
    return v;
  }
  return null;
}

export function saveMobileSetupMode(mode: MobileSetupMode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function clearMobileSetupMode() {
  localStorage.removeItem(STORAGE_KEY);
}
