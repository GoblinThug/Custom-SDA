import { isMobileHost } from "./platform";

const BIO_BLOB_KEY = "csda-bio-vault-blob";

async function loadBio() {
  return import("@tauri-apps/plugin-biometric");
}

function readBlob(): string | null {
  return localStorage.getItem(BIO_BLOB_KEY);
}

const LEGACY_MODE_KEY = "csda-bio-vault-mode";

export function clearBiometricUnlock(): void {
  localStorage.removeItem(BIO_BLOB_KEY);
  localStorage.removeItem(LEGACY_MODE_KEY);
}

function dropLegacyPlaintextGate(): void {
  if (localStorage.getItem(LEGACY_MODE_KEY) === "gate") {
    clearBiometricUnlock();
  }
}

export function isBiometricUnlockStored(): boolean {
  dropLegacyPlaintextGate();
  const blob = readBlob();
  return Boolean(blob?.trim());
}

export async function biometricHardwareAvailable(): Promise<boolean> {
  if (!isMobileHost()) {
    return false;
  }
  try {
    const { checkStatus } = await loadBio();
    const status = await checkStatus();
    return status.isAvailable;
  } catch {
    return false;
  }
}

function authLabels(lang: "ru" | "en") {
  return lang === "ru"
    ? {
        reason: "Разблокировать Custom SDA",
        title: "Отпечаток / Face ID",
        subtitle: "Подтвердите личность, чтобы открыть хранилище",
        cancel: "Отмена",
        enableReason: "Включить вход по биометрии",
        enableTitle: "Включить биометрию",
        enableSubtitle: "После этого можно входить без ввода пароля",
      }
    : {
        reason: "Unlock Custom SDA",
        title: "Fingerprint / Face ID",
        subtitle: "Confirm your identity to open the vault",
        cancel: "Cancel",
        enableReason: "Enable biometric unlock",
        enableTitle: "Enable biometrics",
        enableSubtitle: "Then you can unlock without typing the password",
      };
}

/** Wrap vault password behind biometrics (keystore). Requires biometricCipher. */
export async function enableBiometricUnlock(
  password: string,
  lang: "ru" | "en",
): Promise<boolean> {
  if (!isMobileHost() || !password) {
    return false;
  }
  const labels = authLabels(lang);
  const opts = {
    allowDeviceCredential: false,
    cancelTitle: labels.cancel,
    title: labels.enableTitle,
    subtitle: labels.enableSubtitle,
    confirmationRequired: false,
  };

  try {
    const { checkStatus, biometricCipher } = await loadBio();
    const status = await checkStatus();
    if (!status.isAvailable) {
      return false;
    }

    const encrypted = await biometricCipher(labels.enableReason, {
      ...opts,
      dataToEncrypt: password,
    });
    if (!encrypted?.data) {
      return false;
    }
    localStorage.setItem(BIO_BLOB_KEY, encrypted.data);
    return true;
  } catch {
    return false;
  }
}

/** Prompt biometrics and return the vault password, or null if cancelled/unavailable. */
export async function unlockPasswordViaBiometric(
  lang: "ru" | "en",
): Promise<string | null> {
  if (!isMobileHost() || !isBiometricUnlockStored()) {
    return null;
  }
  const blob = readBlob();
  if (!blob) {
    return null;
  }

  const labels = authLabels(lang);
  const opts = {
    allowDeviceCredential: false,
    cancelTitle: labels.cancel,
    title: labels.title,
    subtitle: labels.subtitle,
    confirmationRequired: false,
  };

  try {
    const { biometricCipher } = await loadBio();
    const decrypted = await biometricCipher(labels.reason, {
      ...opts,
      dataToDecrypt: blob,
    });
    return decrypted?.data || null;
  } catch {
    return null;
  }
}
