import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Account,
  api,
  AppEvent,
  Confirmation,
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
  IconChevronDown,
  IconCopy,
  IconEventImportSuccess,
  IconEye,
  IconEyeSlash,
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

type Tab = "home" | "keys" | "confirmations" | "mobile" | "settings";
type OnboardMode = "choice" | "mafile" | "steam" | null;

function formatCode(code: string) {
  return code.split("").join(" ");
}

function AccountAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <div className="avatar">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        (name[0] ?? "?").toUpperCase()
      )}
    </div>
  );
}

const CODE_FONT_MAX = 42;
const CODE_FONT_MIN = 17;

function fitCodeFontSize(wrap: HTMLElement, text: HTMLElement) {
  text.style.fontSize = `${CODE_FONT_MAX}px`;
  if (wrap.clientWidth <= 0 || text.scrollWidth <= wrap.clientWidth) {
    return;
  }
  let lo = CODE_FONT_MIN;
  let hi = CODE_FONT_MAX;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    text.style.fontSize = `${mid}px`;
    if (text.scrollWidth > wrap.clientWidth) {
      hi = mid - 1;
    } else {
      lo = mid;
    }
  }
  text.style.fontSize = `${lo}px`;
}

function GuardCodeDigits({ code }: { code: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const display = formatCode(code);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) {
      return;
    }

    const fit = () => fitCodeFontSize(wrap, text);

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [display]);

  return (
    <div className="code-digits-wrap" ref={wrapRef}>
      <div className="code-digits" ref={textRef}>
        {display}
      </div>
    </div>
  );
}

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
  const creating = !status.exists;

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
      if (creating) {
        onReady(await api.vaultCreate(password));
      } else {
        onReady(await api.vaultUnlock(password));
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function wipeAll() {
    setBusy(true);
    try {
      const next = await api.vaultWipe();
      clearMobileSetupMode();
      setWipeConfirm(false);
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
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-heading">
          <div className="brand-mark">
            <AppBrandIcon size={28} />
          </div>
          <h1>{creating ? t(lang, "createTitle") : t(lang, "unlockTitle")}</h1>
        </div>
        <p>{creating ? (createHint ?? t(lang, "createHint")) : t(lang, "unlockHint")}</p>
        <div>
          <div className="label">{t(lang, "password")}</div>
          <PasswordField
            value={password}
            onChange={setPassword}
            autoFocus
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
    </div>
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
      await api.importMafile(path);
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
        await api.steamSetupSubmitSms(code);
        setCode("");
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
              await api.importMafileText(maText);
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
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
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
  const [mobileTransferPane, setMobileTransferPane] = useState<"send" | "receive">(
    () =>
      sessionStorage.getItem(PENDING_TRANSFER_STORAGE_KEY) || isMobileHost()
        ? "receive"
        : "send",
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

  const refreshUnlocked = useCallback(async () => {
    let accs = await api.accountsList();
    if (isMobileHost()) {
      const missing = accs.filter((a) => !a.avatar_url?.trim());
      if (missing.length > 0) {
        const refreshed = await Promise.all(
          missing.map((a) =>
            api.accountRefreshAvatar(a.steam_id).catch(() => null),
          ),
        );
        const byId = new Map(
          refreshed.filter(Boolean).map((a) => [a!.steam_id, a!]),
        );
        if (byId.size > 0) {
          accs = accs.map((a) => byId.get(a.steam_id) ?? a);
        }
      }
    }
    const [evs, st] = await Promise.all([api.eventsRecent(), api.settingsGet()]);
    setAccounts(accs);
    setEvents(evs);
    setSettings(st);
    if (accs.length > 0) {
      setForceOnboard(false);
      setGuard(await api.guardCode());
    } else {
      setGuard(null);
    }
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
    refreshUnlocked().catch((e) => notifyError(String(e)));
  }, [status?.unlocked, refreshUnlocked]);

  useEffect(() => {
    if (status?.unlocked && pendingTransfer) {
      setTab("mobile");
    }
  }, [status?.unlocked, pendingTransfer]);

  useEffect(() => {
    if (!status?.unlocked || !selected) return;
    const id = window.setInterval(() => {
      api.guardCode().then(setGuard).catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(id);
  }, [status?.unlocked, selected?.steam_id]);

  function handleVaultReady(next: VaultStatus) {
    setStatus(next);
    if (!next.unlocked || !isMobileHost()) {
      return;
    }
    const mode = loadMobileSetupMode();
    if (mode === "qr") {
      setTab("mobile");
    } else if (mode === "fresh") {
      setForceOnboard(true);
      setTab("keys");
    }
  }

  async function lockVault() {
    try {
      setShowAccounts(false);
      setStatus(await api.vaultLock());
    } catch (e) {
      notifyError(String(e));
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
      await api.importMafile(path);
      await refreshUnlocked();
      setTab("home");
    } catch (e) {
      notifyError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadConfirmations() {
    setBusy(true);
    try {
      setConfirmations(await api.confirmationsList());
    } catch (e) {
      notifyError(String(e));
      setConfirmations([]);
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
        <div className="auth-screen">
          <div className="muted">{t(lang, "loading")}</div>
        </div>
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
                  void refreshUnlocked();
                }}
                onError={notifyError}
                onClear={clearPendingTransfer}
                onOpenScanner={() => setShowInAppQrScanner(true)}
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
    const showAuth =
      !showMobileSetupChoice &&
      !showMobileQrScan &&
      (vaultStatus.exists ||
        mobileSetupMode === "fresh" ||
        (mobileSetupMode === "qr" && Boolean(pendingTransfer)));

    return (
      <WindowFrame title={APP_TITLE}>
        <ToastViewport />
        {showMobileSetupChoice ? (
          <MobileSetupChoice
            lang={lang}
            onChoose={(mode) => {
              saveMobileSetupMode(mode);
              setMobileSetupMode(mode);
            }}
          />
        ) : showMobileQrScan ? (
          <Suspense fallback={<div className="auth-screen muted">{t(lang, "loading")}</div>}>
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
          <div className="auth-screen">
            <div className="muted">{t(lang, "loading")}</div>
          </div>
        )}
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
            className={`nav-btn ${tab === "keys" || showOnboard ? "active" : ""}`}
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
              loadConfirmations();
            }}
            title={t(lang, "confirmations")}
          >
            <IconShield />
          </button>
          <button
            className={`nav-btn ${tab === "mobile" ? "active" : ""}`}
            onClick={() => {
              setForceOnboard(false);
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
          {showOnboard && (tab === "home" || tab === "keys") && (
            <Onboarding
              lang={lang}
              onImported={async () => {
                await refreshUnlocked();
                setForceOnboard(false);
                setTab("home");
              }}
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
                        await api.accountSelect(a.steam_id);
                        setShowAccounts(false);
                        await refreshUnlocked();
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
                  onClick={() => {
                    setTab("confirmations");
                    loadConfirmations();
                  }}
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
              <div className="events">
                {events.length === 0 && <div className="empty">{t(lang, "noEvents")}</div>}
                {events.slice(0, 8).map((ev) => (
                  <div className="event-item" key={ev.id}>
                    {ev.kind === "import" && ev.success ? (
                      <div className="event-icon-import">
                        <IconEventImportSuccess />
                      </div>
                    ) : (
                      <div className={`event-dot ${ev.success ? "ok" : "bad"}`}>✓</div>
                    )}
                    <div className="event-text">{ev.message}</div>
                    <div className="event-time">{ev.time}</div>
                  </div>
                ))}
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
              onImported={async () => {
                await refreshUnlocked();
                setTab("home");
              }}
              onRemove={async (steamId) => {
                await api.accountRemove(steamId);
                await refreshUnlocked();
              }}
              onError={notifyError}
            />
          )}

          {tab === "confirmations" && (
            <div className="panel">
              <div className="page-head">
                <div className="page-head-text">
                  <h2 className="page-title">{t(lang, "confirmations")}</h2>
                  <p className="muted page-lead">{t(lang, "confirmationsLead")}</p>
                </div>
                <button
                  type="button"
                  className="copy-btn"
                  disabled={busy}
                  onClick={loadConfirmations}
                  title={busy ? t(lang, "loading") : t(lang, "refresh")}
                  aria-label={t(lang, "refreshList")}
                >
                  <IconRefresh />
                </button>
              </div>
              {confirmations.length === 0 && !busy && (
                <div className="surface-card confirmations-empty">
                  <div className="empty">{t(lang, "noConfirmations")}</div>
                </div>
              )}
              {confirmations.map((c) => (
                <div className="conf-item" key={c.id}>
                  <div className="conf-head">
                    {c.icon ? <img className="conf-icon" src={c.icon} alt="" /> : null}
                    <div>
                      <div className="conf-title">{c.headline || c.type_name}</div>
                      <div className="conf-summary">{c.summary.join(" · ")}</div>
                    </div>
                  </div>
                  <div className="conf-actions">
                    <button
                      className="accept-btn"
                      onClick={async () => {
                        try {
                          await api.confirmationAccept(c.id, c.nonce);
                          await loadConfirmations();
                          await refreshUnlocked();
                        } catch (e) {
                          notifyError(String(e));
                        }
                      }}
                    >
                      {c.accept_label || t(lang, "confirm")}
                    </button>
                    <button
                      className="deny-btn"
                      onClick={async () => {
                        try {
                          await api.confirmationDeny(c.id, c.nonce);
                          await loadConfirmations();
                          await refreshUnlocked();
                        } catch (e) {
                          notifyError(String(e));
                        }
                      }}
                    >
                      {c.cancel_label || t(lang, "deny")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "mobile" && (
            <div className="mobile-transfer-tab stack">
              {isMobileHost() && !showInAppQrScanner && (
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
              {(isMobileHost()
                ? mobileTransferPane === "receive"
                : pendingTransfer !== null) ? (
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
                      void refreshUnlocked();
                    }}
                    onError={notifyError}
                    onClear={clearPendingTransfer}
                    onOpenScanner={() => setShowInAppQrScanner(true)}
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
              onLangPreview={setUiLang}
              onSave={async (next) => {
                await api.settingsSet(next);
                setSettings(next);
                persistLang(parseLang(next.lang));
              }}
              onLock={lockVault}
              onChangePassword={async (oldPassword, newPassword) => {
                await api.vaultChangePassword(oldPassword, newPassword);
                await refreshUnlocked();
              }}
              onError={notifyError}
            />
          )}
        </main>
      </div>

        <footer className="footer">
          <button className="update-btn" title={t(lang, "checkUpdates")}>
            <IconRefresh />
            {t(lang, "checkUpdates")}
          </button>
          <span>v.0.0.1</span>
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
              await api.importMafileText(maText);
              setMaText("");
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
  onLangPreview,
  onSave,
  onLock,
  onChangePassword,
  onError,
}: {
  lang: Lang;
  settings: VaultSettings;
  onLangPreview: (lang: Lang) => void;
  onSave: (s: VaultSettings) => Promise<void>;
  onLock: () => Promise<void>;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<void>;
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
    </div>
  );
}
