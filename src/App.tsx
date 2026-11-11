import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { VaultBackupPanel } from "./VaultBackupPanel";
import { exportVaultToPickedPath } from "./vaultBackup";
import { GuardCodeDigits } from "./GuardCodeDigits";
import {
  Account,
  api,
  AppEvent,
  GuardCode,
  SetupStatus,
  VaultSettings,
  VaultStatus,
} from "./api";
import {
  I18nKey,
  Lang,
  loadStoredLang,
  parseLang,
  persistLang,
  paletteLabel,
  schemeLabel,
  t,
} from "./i18n";
import {
  EventStatusMark,
  IconChevronDown,
  IconCopy,
  IconEye,
  IconEyeSlash,
  IconFingerprint,
  IconGear,
  IconHome,
  IconImport,
  IconKey,
  IconLock,
  IconLogin,
  IconMobile,
  IconRefresh,
  IconShield,
  AppBrandIcon,
} from "./icons";
import {
  biometricHardwareAvailable,
  clearBiometricUnlock,
  enableBiometricUnlock,
  isBiometricUnlockStored,
  unlockPasswordViaBiometric,
} from "./biometricVault";
import { AccountAvatar } from "./AccountAvatar";
import { ConfirmationsPage } from "./ConfirmationsPage";
import { MobileTransferPage } from "./MobileTransfer";
import { MobileTransferReceive } from "./MobileTransferReceive";
import { MobileSetupChoice } from "./MobileSetupChoice";
const MobileQrScanner = lazy(() =>
  import("./MobileQrScanner").then((m) => ({ default: m.MobileQrScanner })),
);
import {
  clearMobileSetupMode,
  loadMobileSetupMode,
  saveMobileSetupMode,
  type MobileSetupMode,
} from "./mobileSetup";
import { isMobileHost } from "./platform";
import { PENDING_TRANSFER_STORAGE_KEY } from "./transferDeepLink";
import { checkAppUpdate, installAppUpdate } from "./updater";
import { APP_VERSION } from "./version";
import { useTransferDeepLink } from "./useTransferDeepLink";
import { SelectMenu } from "./SelectMenu";
import { WindowFrame } from "./WindowFrame";
import { notifyError, setToastLang, showToast, ToastViewport } from "./toast";
import {
  applyAppearance,
  ColorPalette,
  ColorScheme,
  isColorPalette,
  isColorScheme,
  loadStoredAppearance,
  parseAppearance,
} from "./theme";
import "./App.css";

const APP_TITLE = "Steam Desktop Authenticator";

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-screen">{children}</div>
      <footer className="footer auth-footer">
        <span aria-hidden="true" />
        <span>v.{APP_VERSION}</span>
      </footer>
    </div>
  );
}

type Tab = "home" | "keys" | "confirmations" | "mobile" | "settings";
type OnboardMode = "choice" | "mafile" | "steam" | null;

function PasswordField({
  value,
  onChange,
  placeholder,
  autoFocus,
  lang,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  lang: Lang;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        className="field"
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="eye-btn"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t(lang, "hidePassword") : t(lang, "showPassword")}
      >
        {visible ? <IconEyeSlash /> : <IconEye />}
      </button>
    </div>
  );
}

function AuthGate({
  status,
  onReady,
  lang,
  createHint,
  onBackToSetup,
}: {
  status: VaultStatus;
  onReady: (s: VaultStatus) => void;
  lang: Lang;
  createHint?: string;
  onBackToSetup?: () => void;
}) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [importBackup, setImportBackup] = useState(false);
  const [bioReady, setBioReady] = useState(false);
  const creating = !status.exists;
  const bioTried = useRef(false);

  useEffect(() => {
    if (!isMobileHost() || creating) {
      setBioReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const hw = await biometricHardwareAvailable();
      if (cancelled) return;
      setBioReady(hw && isBiometricUnlockStored());
    })();
    return () => {
      cancelled = true;
    };
  }, [creating, status.exists]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      notifyError(t(lang, "passwordMin6"));
      return;
    }
    if (creating && password !== password2) {
      notifyError(t(lang, "passwordsMismatch"));
      return;
    }
    setBusy(true);
    try {
      const next = creating
        ? await api.vaultCreate(password)
        : await api.vaultUnlock(password);
      onReady(next);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function unlockWithBiometric() {
    setBusy(true);
    try {
      const pw = await unlockPasswordViaBiometric(lang);
      if (!pw) {
        return;
      }
      onReady(await api.vaultUnlock(pw));
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!bioReady || creating || busy || bioTried.current) {
      return;
    }
    bioTried.current = true;
    void unlockWithBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioReady, creating, busy]);

  if (importBackup) {
    return (
      <VaultBackupPanel
        lang={lang}
        variant="setup"
        onSuccess={(next) => {
          clearBiometricUnlock();
          setImportBackup(false);
          onReady(next);
        }}
        onBack={() => setImportBackup(false)}
      />
    );
  }

  async function wipeAll() {
    setBusy(true);
    try {
      const next = await api.vaultWipe();
      clearMobileSetupMode();
      clearBiometricUnlock();
      setWipeConfirm(false);
      setBioReady(false);
      setPassword("");
      setPassword2("");
      onReady(next);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-heading">
          <div className="brand-mark">
            <AppBrandIcon size={28} />
          </div>
          <h1>{creating ? t(lang, "createTitle") : t(lang, "unlockTitle")}</h1>
        </div>
        <p>{creating ? (createHint ?? t(lang, "createHint")) : t(lang, "unlockHint")}</p>
        {!creating && bioReady && (
          <button
            type="button"
            className="primary-btn bio-unlock-btn"
            disabled={busy}
            onClick={() => void unlockWithBiometric()}
          >
            <IconFingerprint />
            {busy ? "..." : t(lang, "bioUnlock")}
          </button>
        )}
        <div>
          <div className="label">{t(lang, "password")}</div>
          <PasswordField
            value={password}
            onChange={setPassword}
            autoFocus={!bioReady}
            lang={lang}
          />
        </div>
        {creating && (
          <div>
            <div className="label">{t(lang, "passwordRepeat")}</div>
            <PasswordField value={password2} onChange={setPassword2} lang={lang} />
          </div>
        )}
        <button className="primary-btn" disabled={busy}>
          {busy ? "..." : creating ? t(lang, "create") : t(lang, "enter")}
        </button>

        {creating && (
          <button
            type="button"
            className="ghost-btn"
            disabled={busy}
            onClick={() => setImportBackup(true)}
          >
            {t(lang, "mobileSetupBackup")}
          </button>
        )}

        {creating && onBackToSetup && (
          <button
            type="button"
            className="ghost-btn"
            disabled={busy}
            onClick={onBackToSetup}
          >
            {t(lang, "mobileSetupBack")}
          </button>
        )}

        {!creating && (
          <button
            type="button"
            className="ghost-btn danger-btn"
            disabled={busy}
            onClick={() => setWipeConfirm(true)}
          >
            {t(lang, "resetAuthenticator")}
          </button>
        )}
      </form>

      {wipeConfirm && (
        <div
          className="auth-overlay"
          onClick={() => !busy && setWipeConfirm(false)}
          role="presentation"
        >
          <div
            className="auth-modal wipe-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wipe-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="wipe-title" className="auth-modal-title">
              {t(lang, "wipeTitle")}
            </h2>
            <p>{t(lang, "wipeBody")}</p>
            <div className="row-actions auth-modal-actions">
              <button
                type="button"
                className="danger-solid-btn"
                disabled={busy}
                onClick={wipeAll}
              >
                {busy ? t(lang, "wiping") : t(lang, "wipeConfirm")}
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={busy}
                onClick={() => setWipeConfirm(false)}
              >
                {t(lang, "cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Onboarding({
  onImported,
  onError,
  lang,
}: {
  onImported: () => Promise<void>;
  onError: (msg: string | null) => void;
  lang: Lang;
}) {
  const [mode, setMode] = useState<OnboardMode>("choice");
  const [busy, setBusy] = useState(false);
  const [maText, setMaText] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<SetupStatus | null>(null);

  async function pickFile() {
    onError(null);
    const path = await open({
      multiple: false,
      filters: [{ name: "maFile", extensions: ["maFile", "json", "txt"] }],
    });
    if (!path || Array.isArray(path)) return;
    setBusy(true);
    try {
      const added = await api.importMafile(path);
      await api.accountSelect(added.steam_id);
      await onImported();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function beginSteam(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      onError(t(lang, "enterSteamLogin"));
      return;
    }
    if (!password) {
      onError(t(lang, "enterSteamPassword"));
      return;
    }
    setBusy(true);
    try {
      setSetup(await api.steamSetupBegin(username, password));
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitSetupCode(e: FormEvent) {
    e.preventDefault();
    if (!setup) return;
    if (setup.needs_code && !code.trim()) {
      onError(t(lang, "enterCode"));
      return;
    }
    setBusy(true);
    try {
      if (setup.phase === "await_code") {
        setSetup(await api.steamSetupSubmitLoginCode(code));
        setCode("");
      } else if (setup.phase === "await_sms" || setup.phase === "await_transfer_sms") {
        const added = await api.steamSetupSubmitSms(code);
        setCode("");
        setSetup(null);
        setMode("choice");
        await api.accountSelect(added.steam_id);
        await onImported();
      }
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (mode === "choice") {
    return (
      <div className="panel">
        <h2 className="page-title">{t(lang, "onboardTitle")}</h2>
        <p className="muted">{t(lang, "onboardLead")}</p>
        <div className="choice-grid">
          <button className="choice-tile" onClick={() => setMode("mafile")}>
            <div className="action-icon">
              <IconImport />
            </div>
            <div>
              <div className="conf-title">{t(lang, "useMafiles")}</div>
              <div className="conf-summary">{t(lang, "useMafilesHint")}</div>
            </div>
          </button>
          <button className="choice-tile" onClick={() => setMode("steam")}>
            <div className="action-icon">
              <IconLogin />
            </div>
            <div>
              <div className="conf-title">{t(lang, "steamLogin")}</div>
              <div className="conf-summary">{t(lang, "steamLoginHint")}</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "mafile") {
    return (
      <div className="panel">
        <h2 className="page-title">{t(lang, "importMafileTitle")}</h2>
        <div className="row-actions">
          <button className="primary-btn" disabled={busy} onClick={pickFile}>
            {t(lang, "pickMafile")}
          </button>
          <button className="ghost-btn" onClick={() => setMode("choice")}>
            {t(lang, "back")}
          </button>
        </div>
        <div>
          <div className="label">{t(lang, "orPasteJson")}</div>
          <textarea
            className="field textarea"
            value={maText}
            onChange={(e) => setMaText(e.target.value)}
            placeholder='{"shared_secret":"..."}'
          />
        </div>
        <button
          className="primary-btn"
          disabled={busy || !maText.trim()}
          onClick={async () => {
            onError(null);
            setBusy(true);
            try {
              const added = await api.importMafileText(maText);
              await api.accountSelect(added.steam_id);
              await onImported();
            } catch (e) {
              onError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t(lang, "importAction")}
        </button>
      </div>
    );
  }

  // steam mode
  return (
    <div className="panel">
      <h2 className="page-title">{t(lang, "steamSignInTitle")}</h2>
      {!setup ? (
        <form className="stack" onSubmit={beginSteam} noValidate>
          <p className="muted">{t(lang, "steamSignInLead")}</p>
          <div>
            <div className="label">{t(lang, "steamUsername")}</div>
            <input
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <div className="label">{t(lang, "password")}</div>
            <PasswordField value={password} onChange={setPassword} lang={lang} />
          </div>
          <div className="row-actions">
            <button className="primary-btn" disabled={busy}>
              {busy ? t(lang, "signingIn") : t(lang, "enter")}
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={async () => {
                await api.steamSetupCancel().catch(() => undefined);
                setMode("choice");
              }}
            >
              {t(lang, "back")}
            </button>
          </div>
        </form>
      ) : (
        <form className="stack" onSubmit={submitSetupCode} noValidate>
          <p className="muted">{t(lang, setup.message_key as I18nKey)}</p>
          {setup.revocation_code && (
            <div className="error" style={{ color: "#fde68a", borderColor: "rgba(250,204,21,.3)", background: "rgba(250,204,21,.08)" }}>
              {t(lang, "revocationCode")}: <strong>{setup.revocation_code}</strong>
            </div>
          )}
          {setup.needs_code && (
            <div>
              <div className="label">
                {setup.code_label_key
                  ? t(lang, setup.code_label_key as I18nKey)
                  : t(lang, "code")}
              </div>
              <input
                className="field"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <div className="row-actions">
            {setup.needs_code ? (
              <button className="primary-btn" disabled={busy}>
                {busy ? "…" : t(lang, "submit")}
              </button>
            ) : (
              <button
                type="button"
                className="primary-btn"
                disabled={busy}
                onClick={async () => {
                  onError(null);
                  setBusy(true);
                  try {
                    setSetup(await api.steamSetupContinue());
                  } catch (e) {
                    onError(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t(lang, "continueAction")}
              </button>
            )}
            <button
              type="button"
              className="ghost-btn"
              onClick={async () => {
                await api.steamSetupCancel().catch(() => undefined);
                setSetup(null);
                setMode("choice");
              }}
            >
              {t(lang, "cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function App() {
  const [boot, setBoot] = useState(true);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [guard, setGuard] = useState<GuardCode | null>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [settings, setSettings] = useState<VaultSettings | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forceOnboard, setForceOnboard] = useState(false);
  const [uiLang, setUiLang] = useState<Lang>(() => loadStoredLang());
  const [pendingTransfer, setPendingTransfer] = useState<string | null>(() =>
    sessionStorage.getItem(PENDING_TRANSFER_STORAGE_KEY),
  );
  const [mobileSetupMode, setMobileSetupMode] = useState<MobileSetupMode | null>(() =>
    isMobileHost() ? loadMobileSetupMode() : null,
  );
  const [showInAppQrScanner, setShowInAppQrScanner] = useState(false);
  const [mobileTransferPane, setMobileTransferPane] = useState<"send" | "receive">(() =>
    sessionStorage.getItem(PENDING_TRANSFER_STORAGE_KEY) ? "receive" : "send",
  );

  const rememberTransfer = useCallback((payload: string) => {
    sessionStorage.setItem(PENDING_TRANSFER_STORAGE_KEY, payload);
    setPendingTransfer(payload);
    setTab("mobile");
    setMobileTransferPane("receive");
    setShowInAppQrScanner(false);
    if (isMobileHost()) {
      saveMobileSetupMode("qr");
      setMobileSetupMode("qr");
    }
  }, []);

  const clearPendingTransfer = useCallback(() => {
    sessionStorage.removeItem(PENDING_TRANSFER_STORAGE_KEY);
    setPendingTransfer(null);
  }, []);

  useTransferDeepLink(rememberTransfer);

  const selected = useMemo(
    () => accounts.find((a) => a.selected) ?? accounts[0] ?? null,
    [accounts],
  );
  const lang = uiLang;
  const showOnboard = forceOnboard || (status?.unlocked && accounts.length === 0);

  type RefreshOpts = { refreshAvatars?: boolean; loadGuard?: boolean };

  const refreshUnlocked = useCallback(async (opts?: RefreshOpts) => {
    const refreshAvatars = opts?.refreshAvatars ?? false;
    const loadGuard = opts?.loadGuard ?? false;
    const [accs, evs, st] = await Promise.all([
      api.accountsList(refreshAvatars),
      api.eventsRecent(),
      api.settingsGet(),
    ]);
    setAccounts(accs);
    setEvents(evs);
    setSettings(st);
    if (accs.length > 0) {
      setForceOnboard(false);
      if (loadGuard) {
        setGuard(await api.guardCode());
      }
    } else {
      setGuard(null);
    }
  }, []);

  const finishAddAccount = useCallback(async () => {
    await refreshUnlocked({ refreshAvatars: true, loadGuard: true });
    setForceOnboard(false);
    setTab("home");
  }, [refreshUnlocked]);

  const refreshAvatarsInBackground = useCallback(() => {
    void api
      .accountsList(true)
      .then(setAccounts)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    applyAppearance(loadStoredAppearance());
    persistLang(loadStoredLang());
  }, []);

  useEffect(() => {
    persistLang(uiLang);
    setToastLang(uiLang);
  }, [uiLang]);

  useEffect(() => {
    if (!settings?.lang) {
      return;
    }
    setUiLang(parseLang(settings.lang));
  }, [settings?.lang]);

  useEffect(() => {
    if (!settings) {
      return;
    }
    applyAppearance(parseAppearance(settings));
  }, [settings?.theme, settings?.palette]);

  useEffect(() => {
    api
      .vaultStatus()
      .then(setStatus)
      .catch((e) => notifyError(String(e)))
      .finally(() => setBoot(false));
  }, []);

  useEffect(() => {
    if (!status?.unlocked) return;
    refreshUnlocked({ refreshAvatars: false, loadGuard: true })
      .then(() => refreshAvatarsInBackground())
      .catch((e) => notifyError(String(e)));
  }, [status?.unlocked, refreshUnlocked, refreshAvatarsInBackground]);

  const lockVault = useCallback(async () => {
    try {
      setShowAccounts(false);
      setStatus(await api.vaultLock());
    } catch (e) {
      notifyError(String(e));
    }
  }, []);

  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!status?.unlocked || !settings?.lock_timeout_secs) {
      return;
    }
    const limitMs = settings.lock_timeout_secs * 1000;
    lastActivityRef.current = Date.now();
    const bump = () => {
      lastActivityRef.current = Date.now();
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    for (const ev of events) {
      window.addEventListener(ev, bump, { passive: true });
    }
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= limitMs) {
        void lockVault();
      }
    }, 1000);
    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, bump);
      }
      window.clearInterval(timer);
    };
  }, [status?.unlocked, settings?.lock_timeout_secs, lockVault]);

  useEffect(() => {
    if (status?.unlocked && pendingTransfer) {
      setTab("mobile");
    }
  }, [status?.unlocked, pendingTransfer]);

  useEffect(() => {
    if (status?.unlocked && accounts.length === 0 && tab !== "keys") {
      setTab("keys");
    }
  }, [status?.unlocked, accounts.length, tab]);

  useEffect(() => {
    if (!status?.unlocked || !selected) return;
    const id = window.setInterval(() => {
      api.guardCode().then(setGuard).catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(id);
  }, [status?.unlocked, selected?.steam_id]);

  function handleVaultReady(next: VaultStatus) {
    setStatus(next);
    if (!next.unlocked) {
      return;
    }
    if (isMobileHost()) {
      const mode = loadMobileSetupMode();
      if (mode === "qr") {
        setTab("mobile");
      } else if (mode === "fresh") {
        setForceOnboard(true);
        setTab("keys");
      } else if (mode === "backup") {
        clearMobileSetupMode();
        setMobileSetupMode(null);
      }
    }
  }

  async function copyCode() {
    if (!guard) return;
    try {
      await navigator.clipboard.writeText(guard.code);
      setCopied(true);
      showToast(t(lang, "codeCopied"), "success");
      window.setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      notifyError(String(e));
    }
  }

  async function pickMaFile() {
    const path = await open({
      multiple: false,
      filters: [{ name: "maFile", extensions: ["maFile", "json", "txt"] }],
    });
    if (!path || Array.isArray(path)) return;
    setBusy(true);
    try {
      const added = await api.importMafile(path);
      await api.accountSelect(added.steam_id);
      await finishAddAccount();
    } catch (e) {
      notifyError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const mobileImportFocus =
    isMobileHost() &&
    status?.unlocked &&
    accounts.length === 0 &&
    (pendingTransfer !== null || showInAppQrScanner);

  if (boot) {
    return (
      <WindowFrame title={APP_TITLE}>
        <ToastViewport />
        <AuthLayout>
          <div className="muted">{t(lang, "loading")}</div>
        </AuthLayout>
      </WindowFrame>
    );
  }

  if (mobileImportFocus) {
    return (
      <WindowFrame title={t(lang, "brand")}>
        <ToastViewport />
        <div className="auth-screen mobile-import-focus">
          {showInAppQrScanner ? (
            <Suspense fallback={<div className="muted">{t(lang, "loading")}</div>}>
              <MobileQrScanner
                lang={lang}
                onPayload={(payload) => {
                  rememberTransfer(payload);
                  setShowInAppQrScanner(false);
                }}
                onBack={() => setShowInAppQrScanner(false)}
                onError={(msg) => notifyError(msg)}
              />
            </Suspense>
          ) : (
            <div className="auth-card mobile-import-receive">
              <MobileTransferReceive
                lang={lang}
                qrPayload={pendingTransfer}
                accounts={accounts}
                onImported={() => {
                  void finishAddAccount();
                }}
                onError={notifyError}
                onClear={clearPendingTransfer}
                onOpenScanner={() => setShowInAppQrScanner(true)}
                onCapturedPayload={rememberTransfer}
              />
            </div>
          )}
        </div>
      </WindowFrame>
    );
  }

  if (!status?.unlocked) {
    const vaultStatus = status ?? { exists: false, unlocked: false, account_count: 0 };
    const showMobileSetupChoice =
      isMobileHost() &&
      !vaultStatus.exists &&
      mobileSetupMode === null &&
      !pendingTransfer;
    const showMobileQrScan =
      isMobileHost() &&
      !vaultStatus.exists &&
      mobileSetupMode === "qr" &&
      !pendingTransfer;
    const showMobileBackup =
      isMobileHost() &&
      !vaultStatus.exists &&
      mobileSetupMode === "backup" &&
      !pendingTransfer;
    const showAuth =
      !showMobileSetupChoice &&
      !showMobileQrScan &&
      !showMobileBackup &&
      (!isMobileHost() ||
        vaultStatus.exists ||
        mobileSetupMode === "fresh" ||
        (mobileSetupMode === "qr" && Boolean(pendingTransfer)));

    return (
      <WindowFrame title={APP_TITLE}>
        <ToastViewport />
        <AuthLayout>
        {showMobileSetupChoice ? (
          <MobileSetupChoice
            lang={lang}
            onChoose={(mode) => {
              saveMobileSetupMode(mode);
              setMobileSetupMode(mode);
            }}
          />
        ) : showMobileQrScan ? (
          <Suspense fallback={<div className="muted">{t(lang, "loading")}</div>}>
            <MobileQrScanner
              lang={lang}
              onPayload={(payload) => {
                rememberTransfer(payload);
              }}
              onBack={() => {
                clearMobileSetupMode();
                setMobileSetupMode(null);
              }}
              onError={(msg) => notifyError(msg)}
            />
          </Suspense>
        ) : showMobileBackup ? (
          <VaultBackupPanel
            lang={lang}
            variant="setup"
            onSuccess={(next) => {
              clearBiometricUnlock();
              clearMobileSetupMode();
              setMobileSetupMode(null);
              handleVaultReady(next);
            }}
            onBack={() => {
              clearMobileSetupMode();
              setMobileSetupMode(null);
            }}
          />
        ) : showAuth ? (
          <AuthGate
            status={vaultStatus}
            onReady={handleVaultReady}
            lang={lang}
            createHint={
              isMobileHost() && !vaultStatus.exists
                ? t(
                    lang,
                    mobileSetupMode === "qr"
                      ? "mobileVaultCreateQr"
                      : "mobileVaultCreateFresh",
                  )
                : undefined
            }
            onBackToSetup={
              isMobileHost() && !vaultStatus.exists
                ? () => {
                    if (mobileSetupMode === "qr" && pendingTransfer) {
                      clearPendingTransfer();
                      return;
                    }
                    clearMobileSetupMode();
                    setMobileSetupMode(null);
                  }
                : undefined
            }
          />
        ) : (
          <div className="muted">{t(lang, "loading")}</div>
        )}
        </AuthLayout>
      </WindowFrame>
    );
  }

  return (
    <WindowFrame title={t(lang, "brand")}>
      <ToastViewport />
      <div className="app-shell">
        <div className="body-row">
        <nav className="sidebar" aria-label={t(lang, "navLabel")}>
          <div className="sidebar-nav">
          <button
            className={`nav-btn ${tab === "home" && !showOnboard ? "active" : ""}`}
            onClick={() => {
              setForceOnboard(false);
              setTab("home");
            }}
            title={t(lang, "home")}
          >
            <IconHome />
          </button>
          <button
            className={`nav-btn ${tab === "keys" ? "active" : ""}`}
            onClick={() => {
              setTab("keys");
              if (accounts.length === 0) setForceOnboard(true);
            }}
            title={t(lang, "accounts")}
          >
            <IconKey />
          </button>
          <button
            className={`nav-btn ${tab === "confirmations" ? "active" : ""}`}
            onClick={() => {
              setForceOnboard(false);
              setTab("confirmations");
            }}
            title={t(lang, "confirmations")}
          >
            <IconShield />
          </button>
          <button
            className={`nav-btn ${tab === "mobile" ? "active" : ""}`}
            onClick={() => {
              setForceOnboard(false);
              setShowInAppQrScanner(false);
              if (accounts.length === 0) {
                setMobileTransferPane("receive");
              }
              setTab("mobile");
            }}
            title={t(lang, "mobile")}
          >
            <IconMobile />
          </button>
          <button
            className={`nav-btn ${tab === "settings" ? "active" : ""}`}
            onClick={() => {
              setForceOnboard(false);
              setTab("settings");
            }}
            title={t(lang, "settings")}
          >
            <IconGear />
          </button>
          </div>
          <button
            type="button"
            className="nav-btn nav-btn-lock"
            onClick={() => {
              void lockVault();
            }}
            title={t(lang, "lockApp")}
            aria-label={t(lang, "lockApp")}
          >
            <IconLock />
          </button>
        </nav>

        <main className="content">
          {showOnboard && tab === "keys" && (
            <Onboarding
              lang={lang}
              onImported={() => finishAddAccount()}
              onError={notifyError}
            />
          )}

          {!showOnboard && tab === "home" && (
            <div className="panel">
              <div className="account-switcher">
                <button
                  className="account-selector"
                  onClick={() => setShowAccounts((v) => !v)}
                  type="button"
                  aria-expanded={showAccounts}
                >
                  <AccountAvatar
                    name={selected?.account_name ?? "?"}
                    avatarUrl={selected?.avatar_url ?? null}
                  />
                  <div className="account-meta">
                    <div className="account-name">
                      {selected?.account_name ?? t(lang, "noAccount")}
                    </div>
                    <div className="account-sub">
                      {selected
                        ? selected.has_session
                          ? t(lang, "sessionActive")
                          : t(lang, "codeOnly")
                        : t(lang, "addAccountHint")}
                    </div>
                  </div>
                  <span className={`chevron ${showAccounts ? "is-open" : ""}`}>
                    <IconChevronDown size={20} />
                  </span>
                </button>

                <div
                  className={`dropdown menu-dropdown account-dropdown${showAccounts ? " is-open" : ""}`}
                  aria-hidden={!showAccounts}
                  inert={!showAccounts ? true : undefined}
                >
                  {accounts.map((a) => (
                    <button
                      key={a.steam_id + a.account_name}
                      className={a.selected ? "active" : ""}
                      onClick={async () => {
                        const id = a.steam_id;
                        await api.accountSelect(id);
                        setShowAccounts(false);
                        setAccounts((prev) =>
                          prev.map((x) => ({
                            ...x,
                            selected: x.steam_id === id,
                          })),
                        );
                        try {
                          setGuard(await api.guardCode());
                        } catch (e) {
                          notifyError(String(e));
                        }
                      }}
                    >
                      {a.account_name}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowAccounts(false);
                      setForceOnboard(true);
                      setTab("keys");
                    }}
                  >
                    + {t(lang, "addAccount")}
                  </button>
                </div>
              </div>

              {guard ? (
                <div className="code-block">
                  <div className="code-row">
                    <GuardCodeDigits code={guard.code} />
                    <button
                      className={`copy-btn ${copied ? "copied" : ""}`}
                      onClick={copyCode}
                      title={t(lang, "copy")}
                    >
                      <IconCopy />
                    </button>
                  </div>
                  <div className="progress-row">
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${(guard.seconds_remaining / 30) * 100}%` }}
                      />
                    </div>
                    <div className="timer">{guard.seconds_remaining}s</div>
                  </div>
                </div>
              ) : (
                <div className="empty">{t(lang, "noGuardHint")}</div>
              )}

              <div className="action-grid">
                <button
                  className="action-tile"
                  onClick={() => setTab("confirmations")}
                >
                  <div className="action-icon">
                    <IconShield />
                  </div>
                  <div className="action-label">{t(lang, "confirmations")}</div>
                </button>
                <button className="action-tile" onClick={() => setTab("settings")}>
                  <div className="action-icon">
                    <IconLock />
                  </div>
                  <div className="action-label">{t(lang, "encryption")}</div>
                </button>
              </div>

              <h3 className="section-title">{t(lang, "recentEvents")}</h3>
              <div className="events-scroll">
                <div className="events">
                  {events.length === 0 && (
                    <div className="empty">{t(lang, "noEvents")}</div>
                  )}
                  {events.map((ev) => (
                    <div className="event-item" key={ev.id}>
                      <EventStatusMark success={ev.success} />
                      <div className="event-text">{ev.message}</div>
                      <div className="event-time">{ev.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!showOnboard && tab === "keys" && (
            <KeysPage
              lang={lang}
              accounts={accounts}
              busy={busy}
              onPickFile={pickMaFile}
              onAddAccount={() => setForceOnboard(true)}
              onImported={() => finishAddAccount()}
              onRemove={async (steamId) => {
                await api.accountRemove(steamId);
                await refreshUnlocked({ loadGuard: true });
              }}
              onError={notifyError}
            />
          )}

          {tab === "confirmations" && (
            <ConfirmationsPage
              lang={lang}
              selected={selected}
              accounts={accounts}
              onAccountsChanged={async () => {
                await refreshUnlocked({ refreshAvatars: false, loadGuard: true });
              }}
              onError={(msg) => {
                if (msg) notifyError(msg);
              }}
            />
          )}

          {tab === "mobile" && (
            <div className="mobile-transfer-tab stack">
              {!showInAppQrScanner && (
                <div className="segmented" role="tablist" aria-label={t(lang, "mobile")}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mobileTransferPane === "send"}
                    className={mobileTransferPane === "send" ? "active" : undefined}
                    onClick={() => {
                      setMobileTransferPane("send");
                      setShowInAppQrScanner(false);
                    }}
                  >
                    {t(lang, "mobileTransferSendTab")}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mobileTransferPane === "receive"}
                    className={mobileTransferPane === "receive" ? "active" : undefined}
                    onClick={() => setMobileTransferPane("receive")}
                  >
                    {t(lang, "mobileTransferReceiveTab")}
                  </button>
                </div>
              )}
              {mobileTransferPane === "receive" ? (
                showInAppQrScanner ? (
                  <Suspense fallback={<div className="muted">{t(lang, "loading")}</div>}>
                    <MobileQrScanner
                      lang={lang}
                      onPayload={(payload) => {
                        rememberTransfer(payload);
                        setShowInAppQrScanner(false);
                      }}
                      onBack={() => setShowInAppQrScanner(false)}
                      onError={notifyError}
                    />
                  </Suspense>
                ) : (
                  <MobileTransferReceive
                    lang={lang}
                    qrPayload={pendingTransfer}
                    accounts={accounts}
                    onImported={() => {
                      void finishAddAccount();
                    }}
                    onError={notifyError}
                    onClear={clearPendingTransfer}
                    onOpenScanner={() => setShowInAppQrScanner(true)}
                    onCapturedPayload={rememberTransfer}
                  />
                )
              ) : (
                <MobileTransferPage
                  lang={lang}
                  accounts={accounts}
                  onError={notifyError}
                />
              )}
            </div>
          )}

          {tab === "settings" && settings && (
            <SettingsPage
              lang={lang}
              settings={settings}
              accountCount={accounts.length}
              onLangPreview={setUiLang}
              onSave={async (next) => {
                await api.settingsSet(next);
                setSettings(next);
                persistLang(parseLang(next.lang));
              }}
              onLock={lockVault}
              onChangePassword={async (oldPassword, newPassword) => {
                const hadBio = isBiometricUnlockStored();
                await api.vaultChangePassword(oldPassword, newPassword);
                clearBiometricUnlock();
                if (hadBio && isMobileHost()) {
                  showToast(t(lang, "bioReenableAfterPassword"), "success");
                }
                await refreshUnlocked();
              }}
              onVaultImported={async (next) => {
                clearBiometricUnlock();
                setStatus(next);
                await refreshUnlocked({ loadGuard: true });
              }}
              onError={notifyError}
            />
          )}
        </main>
      </div>

        <footer className="footer">
          <button
            type="button"
            className="update-btn"
            title={t(lang, "checkUpdates")}
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  showToast(t(lang, "updateChecking"), "success");
                  const result = await checkAppUpdate();
                  if (result.status === "unsupported") {
                    showToast(
                      t(
                        lang,
                        result.platform === "ios"
                          ? "updateUnsupportedIos"
                          : "updateUnsupported",
                      ),
                      "success",
                    );
                    return;
                  }
                  if (result.status === "upToDate") {
                    showToast(t(lang, "updateUpToDate"), "success");
                    return;
                  }
                  if (result.status === "error") {
                    notifyError(`${t(lang, "updateFailed")}: ${result.message}`);
                    return;
                  }
                  const msg = (
                    result.androidApk
                      ? t(lang, "updateAvailableAndroid")
                      : t(lang, "updateAvailable")
                  ).replace("{version}", result.version);
                  if (!window.confirm(msg)) {
                    return;
                  }
                  showToast(t(lang, "updateInstalling"), "success");
                  const installed = await installAppUpdate(result.downloadUrl);
                  if (installed.status === "error") {
                    notifyError(`${t(lang, "updateFailed")}: ${installed.message}`);
                  }
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <IconRefresh />
            {t(lang, "checkUpdates")}
          </button>
          <span>v.{APP_VERSION}</span>
        </footer>
      </div>
    </WindowFrame>
  );
}

function KeysPage({
  lang,
  accounts,
  busy,
  onPickFile,
  onAddAccount,
  onImported,
  onRemove,
  onError,
}: {
  lang: Lang;
  accounts: Account[];
  busy: boolean;
  onPickFile: () => void;
  onAddAccount: () => void;
  onImported: () => Promise<void>;
  onRemove: (steamId: string) => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [maText, setMaText] = useState("");
  const [importing, setImporting] = useState(false);

  return (
    <div className="panel">
      <h2 className="page-title">{t(lang, "accounts")}</h2>
      <p className="muted page-lead">{t(lang, "keysLead")}</p>

      <div className="action-grid">
        <button type="button" className="action-tile" onClick={onAddAccount}>
          <div className="action-icon">
            <IconLogin />
          </div>
          <div className="action-label">{t(lang, "addAccount")}</div>
        </button>
        <button
          type="button"
          className="action-tile"
          disabled={busy}
          onClick={onPickFile}
        >
          <div className="action-icon">
            <IconImport />
          </div>
          <div className="action-label">{t(lang, "pickMafile")}</div>
        </button>
      </div>

      <div className="surface-card">
        <div className="label">{t(lang, "pasteMafile")}</div>
        <textarea
          className="field textarea textarea-compact"
          value={maText}
          onChange={(e) => setMaText(e.target.value)}
          placeholder='{"shared_secret":"..."}'
        />
        <button
          type="button"
          className="primary-btn"
          disabled={importing || !maText.trim()}
          onClick={async () => {
            onError(null);
            setImporting(true);
            try {
              const added = await api.importMafileText(maText);
              setMaText("");
              await api.accountSelect(added.steam_id);
              await onImported();
            } catch (e) {
              onError(String(e));
            } finally {
              setImporting(false);
            }
          }}
        >
          {importing ? t(lang, "importing") : t(lang, "importJson")}
        </button>
      </div>

      <h3 className="section-title">{t(lang, "accountList")}</h3>
      <div className="account-list">
        {accounts.length === 0 && (
          <div className="empty">{t(lang, "noAccountsYet")}</div>
        )}
        {accounts.map((a) => (
          <div className="account-row" key={a.steam_id + a.account_name}>
            <AccountAvatar name={a.account_name} avatarUrl={a.avatar_url} />
            <div className="account-meta">
              <div className="account-name">{a.account_name}</div>
              <div className="account-sub">
                {a.has_session ? t(lang, "sessionActive") : t(lang, "codeOnly")}
              </div>
            </div>
            <button
              type="button"
              className="ghost-btn danger-btn row-action-btn"
              onClick={() => onRemove(a.steam_id)}
            >
              {t(lang, "remove")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage({
  lang: uiLang,
  settings,
  accountCount,
  onLangPreview,
  onSave,
  onLock,
  onChangePassword,
  onVaultImported,
  onError,
}: {
  lang: Lang;
  settings: VaultSettings;
  accountCount: number;
  onLangPreview: (lang: Lang) => void;
  onSave: (s: VaultSettings) => Promise<void>;
  onLock: () => Promise<void>;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  onVaultImported: (status: VaultStatus) => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [lang, setLang] = useState(settings.lang);
  const [scheme, setScheme] = useState<ColorScheme>(
    () => parseAppearance(settings).scheme,
  );
  const [palette, setPalette] = useState<ColorPalette>(
    () => parseAppearance(settings).palette,
  );
  const [timeoutSecs, setTimeoutSecs] = useState(String(settings.lock_timeout_secs));

  useEffect(() => {
    setLang(settings.lang);
    setTimeoutSecs(String(settings.lock_timeout_secs));
    const next = parseAppearance(settings);
    setScheme(next.scheme);
    setPalette(next.palette);
  }, [settings]);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [bioHardware, setBioHardware] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioEnablePassword, setBioEnablePassword] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [importArmed, setImportArmed] = useState(false);

  const showBioSettings = isMobileHost() && bioHardware;

  useEffect(() => {
    if (!isMobileHost()) {
      setBioHardware(false);
      setBioEnabled(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const hw = await biometricHardwareAvailable();
      if (cancelled) return;
      setBioHardware(hw);
      setBioEnabled(hw && isBiometricUnlockStored());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const langOptions = [
    { value: "ru", label: "Русский" },
    { value: "en", label: "English" },
  ];
  const schemeOptions = (["dark", "light"] as ColorScheme[]).map((value) => ({
    value,
    label: schemeLabel(uiLang, value),
  }));
  const paletteOptions = (
    ["steam", "violet", "emerald", "rose", "amber", "cyan"] as ColorPalette[]
  ).map((value) => ({
    value,
    label: paletteLabel(uiLang, value),
  }));

  return (
    <div className="panel">
      <h2 className="page-title">{t(uiLang, "settings")}</h2>

      <div className="surface-card stack">
        <h3 className="inline-section-title">{t(uiLang, "general")}</h3>
        <SelectMenu
          label={t(uiLang, "language")}
          value={lang}
          options={langOptions}
          onChange={(value) => {
            setLang(value);
            onLangPreview(parseLang(value));
          }}
        />
        <SelectMenu
          label={t(uiLang, "scheme")}
          value={scheme}
          options={schemeOptions}
          onChange={(value) => {
            if (!isColorScheme(value)) {
              return;
            }
            setScheme(value);
            applyAppearance({ scheme: value, palette });
          }}
        />
        <SelectMenu
          label={t(uiLang, "palette")}
          value={palette}
          options={paletteOptions}
          onChange={(value) => {
            if (!isColorPalette(value)) {
              return;
            }
            setPalette(value);
            applyAppearance({ scheme, palette: value });
          }}
        />
        <div>
          <div className="label">{t(uiLang, "autoLock")}</div>
          <input
            className="field"
            value={timeoutSecs}
            onChange={(e) => setTimeoutSecs(e.target.value)}
            inputMode="numeric"
          />
        </div>
        <button
          type="button"
          className="primary-btn"
          onClick={async () => {
            onError(null);
            try {
              await onSave({
                lang,
                theme: scheme,
                palette,
                lock_timeout_secs: Number(timeoutSecs) || 0,
              });
              showToast(t(uiLang, "settingsSaved"), "success");
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          {t(uiLang, "save")}
        </button>
      </div>

      {showBioSettings && (
        <div className="surface-card stack bio-settings">
          <h3 className="inline-section-title">{t(uiLang, "bioSection")}</h3>
          <p className="muted card-hint">{t(uiLang, "bioSettingsHint")}</p>
          <div className="bio-settings-status">
            <IconFingerprint />
            <span>
              {bioEnabled ? t(uiLang, "bioSettingsOn") : t(uiLang, "bioSettingsOff")}
            </span>
          </div>
          {bioEnabled ? (
            <button
              type="button"
              className="ghost-btn danger-btn"
              disabled={bioBusy}
              onClick={() => {
                setBioBusy(true);
                try {
                  clearBiometricUnlock();
                  setBioEnabled(false);
                  setBioEnablePassword("");
                  showToast(t(uiLang, "bioDisabled"), "success");
                } finally {
                  setBioBusy(false);
                }
              }}
            >
              {t(uiLang, "bioSettingsDisable")}
            </button>
          ) : (
            <>
              <div>
                <div className="label">{t(uiLang, "bioSettingsPasswordHint")}</div>
                <PasswordField
                  value={bioEnablePassword}
                  onChange={setBioEnablePassword}
                  lang={uiLang}
                />
              </div>
              <button
                type="button"
                className="primary-btn bio-unlock-btn"
                disabled={bioBusy || bioEnablePassword.length < 6}
                onClick={async () => {
                  if (bioEnablePassword.length < 6) {
                    onError(t(uiLang, "bioPasswordRequired"));
                    return;
                  }
                  setBioBusy(true);
                  onError(null);
                  try {
                    await api.vaultVerifyPassword(bioEnablePassword);
                    const ok = await enableBiometricUnlock(bioEnablePassword, uiLang);
                    if (ok) {
                      setBioEnabled(true);
                      setBioEnablePassword("");
                      showToast(t(uiLang, "bioEnabled"), "success");
                    } else {
                      showToast(t(uiLang, "bioUnavailable"), "error");
                    }
                  } catch (e) {
                    onError(String(e));
                  } finally {
                    setBioBusy(false);
                  }
                }}
              >
                <IconFingerprint />
                {bioBusy ? "…" : t(uiLang, "bioSettingsEnable")}
              </button>
            </>
          )}
        </div>
      )}

      <div className="surface-card stack">
        <h3 className="inline-section-title">{t(uiLang, "encryptionSection")}</h3>
        <p className="muted card-hint">{t(uiLang, "encryptionHint")}</p>

        <div>
          <div className="label">{t(uiLang, "currentPassword")}</div>
          <input
            className="field"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </div>
        <div>
          <div className="label">{t(uiLang, "newPassword")}</div>
          <input
            className="field"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <button
          className="ghost-btn"
          onClick={async () => {
            onError(null);
            try {
              await onChangePassword(oldPassword, newPassword);
              setOldPassword("");
              setNewPassword("");
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          {t(uiLang, "changePassword")}
        </button>
        <button className="primary-btn" onClick={() => onLock()}>
          {t(uiLang, "lockVault")}
        </button>
      </div>

      <div className="surface-card stack settings-backup-card">
        <h3 className="inline-section-title">{t(uiLang, "vaultBackupSection")}</h3>
        <p className="muted card-hint">{t(uiLang, "vaultBackupHint")}</p>

        <button
          type="button"
          className="ghost-btn"
          disabled={backupBusy}
          onClick={async () => {
            onError(null);
            setBackupBusy(true);
            try {
              const ok = await exportVaultToPickedPath();
              if (!ok) {
                return;
              }
              showToast(t(uiLang, "vaultBackupExportOk"), "success");
            } catch (e) {
              onError(String(e));
            } finally {
              setBackupBusy(false);
            }
          }}
        >
          {backupBusy ? "…" : t(uiLang, "vaultBackupExport")}
        </button>

        {!importArmed ? (
          <button type="button" className="ghost-btn" onClick={() => setImportArmed(true)}>
            {t(uiLang, "vaultBackupImportBtn")}
          </button>
        ) : (
          <>
            {accountCount > 0 && (
              <p className="muted card-hint">{t(uiLang, "vaultBackupImportReplace")}</p>
            )}
            <VaultBackupPanel
              lang={uiLang}
              variant="settings"
              onSuccess={async (next) => {
                setImportArmed(false);
                await onVaultImported(next);
              }}
            />
            <button type="button" className="ghost-btn" onClick={() => setImportArmed(false)}>
              {t(uiLang, "cancel")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
