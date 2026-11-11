import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Account,
  Confirmation,
  GuardCode,
  SessionLoginStatus,
  SetupStatus,
  api,
} from "./api";
import { I18nKey, Lang, t } from "./i18n";
import { AccountAvatar } from "./AccountAvatar";
import {
  IconChevronDown,
  IconCopy,
  IconEye,
  IconEyeSlash,
  IconImport,
  IconLogin,
  IconRefresh,
} from "./icons";

type Mode = "auto" | "choice" | "mafile" | "login" | "new_setup";

function formatCode(code: string) {
  return code.split("").join(" ");
}

function fitCodeFontSize(wrap: HTMLElement, text: HTMLElement) {
  let size = 42;
  text.style.fontSize = `${size}px`;
  while (size > 18 && text.scrollWidth > wrap.clientWidth) {
    size -= 1;
    text.style.fontSize = `${size}px`;
  }
}

function GuardCodeDigits({ code }: { code: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const display = formatCode(code);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) return;
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

function accountCanConfirm(a: Account | null | undefined): boolean {
  return Boolean(a?.has_session && a?.has_identity);
}

function accountNeedsReauth(a: Account | null | undefined): boolean {
  return !a?.has_session;
}

function accountNeedsMafileImport(a: Account | null | undefined): boolean {
  return !a?.has_identity;
}

export function ConfirmationsPage({
  lang,
  selected,
  accounts,
  onAccountsChanged,
  onError,
}: {
  lang: Lang;
  selected: Account | null;
  accounts: Account[];
  onAccountsChanged: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("auto");
  const [busy, setBusy] = useState(false);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [listReady, setListReady] = useState(false);

  const [username, setUsername] = useState(selected?.account_name ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [session, setSession] = useState<SessionLoginStatus | null>(null);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [liveGuard, setLiveGuard] = useState<GuardCode | null>(null);
  const [maText, setMaText] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [guardCopied, setGuardCopied] = useState(false);

  const showSetup =
    mode === "choice" ||
    mode === "mafile" ||
    mode === "login" ||
    mode === "new_setup" ||
    (mode === "auto" && !accountCanConfirm(selected));

  useEffect(() => {
    setUsername((prev) => prev || selected?.account_name || "");
  }, [selected?.account_name]);

  useEffect(() => {
    if (mode === "auto" && accountCanConfirm(selected)) {
      void loadList();
    } else if (mode === "auto" && !accountCanConfirm(selected)) {
      setListReady(false);
      setConfirmations([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.steam_id, selected?.has_session, selected?.has_identity, mode]);

  useEffect(() => {
    const showLive =
      Boolean(session?.known_account) &&
      (Boolean(session?.needs_code) || session?.phase === "await_confirm");
    if (!showLive || !session) {
      setLiveGuard(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const g = await api.guardCodeFor({
          steamId: session.steam_id ?? undefined,
          accountName: session.account_name,
        });
        if (!cancelled) setLiveGuard(g);
      } catch {
        if (!cancelled) setLiveGuard(null);
      }
    };
    void tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    session?.known_account,
    session?.needs_code,
    session?.phase,
    session?.steam_id,
    session?.account_name,
  ]);

  async function loadList() {
    setBusy(true);
    onError(null);
    try {
      const list = await api.confirmationsList();
      setConfirmations(list);
      setListReady(true);
      setMode("auto");
    } catch (e) {
      const msg = String(e);
      onError(msg);
      setConfirmations([]);
      setListReady(false);
      setMode("choice");
    } finally {
      setBusy(false);
    }
  }

  async function afterSessionOk() {
    await onAccountsChanged();
    setSession(null);
    setPassword("");
    setCode("");
    setMode("auto");
    await loadList();
  }

  async function beginLogin(e: FormEvent) {
    e.preventDefault();
    onError(null);
    setBusy(true);
    try {
      await api.steamSessionCancel().catch(() => undefined);
      await api.steamSetupCancel().catch(() => undefined);
      const st = await api.steamSessionBegin(username.trim(), password);
      setSession(st);
      if (st.finished) {
        onError(null);
        await afterSessionOk();
        return;
      }
      if (st.continue_as_new_setup) {
        setSetup({
          phase: st.phase,
          message_key: st.message_key,
          code_label_key: st.code_label_key,
          needs_code: st.needs_code,
          revocation_code: null,
        });
        setMode("new_setup");
        setSession(null);
        return;
      }
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitSessionCode(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    onError(null);
    setBusy(true);
    try {
      if (session.needs_code) {
        if (!code.trim()) {
          onError(t(lang, "enterCode"));
          return;
        }
        const st = await api.steamSessionSubmitCode(code.trim());
        setCode("");
        await handleSessionStatus(st);
      } else {
        const st = await api.steamSessionContinue();
        await handleSessionStatus(st);
      }
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSessionStatus(st: SessionLoginStatus) {
    setSession(st);
    if (st.finished) {
      await afterSessionOk();
      return;
    }
    if (st.continue_as_new_setup) {
      setSetup({
        phase: st.phase,
        message_key: st.message_key,
        code_label_key: st.code_label_key,
        needs_code: st.needs_code,
        revocation_code: null,
      });
      setMode("new_setup");
      setSession(null);
    }
  }

  async function submitNewSetup(e: FormEvent) {
    e.preventDefault();
    if (!setup) return;
    onError(null);
    setBusy(true);
    try {
      if (setup.phase === "await_sms" || setup.phase === "await_transfer_sms") {
        if (!code.trim()) {
          onError(t(lang, "enterCode"));
          return;
        }
        await api.steamSetupSubmitSms(code.trim());
        setCode("");
        setSetup(null);
        await afterSessionOk();
        return;
      }
      if (setup.needs_code && setup.phase === "await_code") {
        // Should not happen in new_setup handoff; keep for safety
        const st = await api.steamSetupSubmitLoginCode(code.trim());
        setSetup(st);
        setCode("");
        return;
      }
      const st = await api.steamSetupContinue();
      setSetup(st);
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function pickMaFile() {
    onError(null);
    const path = await open({
      multiple: false,
      filters: [{ name: "maFile", extensions: ["maFile", "json", "txt"] }],
    });
    if (!path || Array.isArray(path)) return;
    setBusy(true);
    try {
      await api.importMafile(path);
      await afterSessionOk();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function importMaText() {
    onError(null);
    setBusy(true);
    try {
      await api.importMafileText(maText);
      setMaText("");
      await afterSessionOk();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetToChoice() {
    await api.steamSessionCancel().catch(() => undefined);
    await api.steamSetupCancel().catch(() => undefined);
    setSession(null);
    setSetup(null);
    setCode("");
    setPassword("");
    setMode("choice");
  }

  if (mode === "auto" && accountCanConfirm(selected) && !listReady) {
    return (
      <div className="panel">
        <div className="page-head page-head--stacked">
          <div className="page-head-text">
            <h2 className="page-title">{t(lang, "confirmations")}</h2>
            <p className="muted page-lead">{t(lang, "confirmationsLead")}</p>
          </div>
          <div className="row-actions confirmations-toolbar">
            <button
              type="button"
              className="ghost-btn"
              disabled={busy}
              onClick={() => void loadList()}
              title={busy ? t(lang, "loading") : t(lang, "refresh")}
              aria-label={t(lang, "refreshList")}
            >
              <IconRefresh />
              {busy ? t(lang, "loading") : t(lang, "refresh")}
            </button>
          </div>
        </div>
        {busy && <div className="muted empty">{t(lang, "loading")}</div>}
      </div>
    );
  }

  if (!showSetup && listReady) {
    return (
      <div className="panel">
        <div className="page-head page-head--stacked">
          <div className="page-head-text">
            <h2 className="page-title">{t(lang, "confirmations")}</h2>
            <p className="muted page-lead">{t(lang, "confirmationsLead")}</p>
          </div>
          <div className="row-actions confirmations-toolbar">
            <button
              type="button"
              className="ghost-btn"
              disabled={busy}
              onClick={() => void loadList()}
              title={busy ? t(lang, "loading") : t(lang, "refresh")}
              aria-label={t(lang, "refreshList")}
            >
              <IconRefresh />
              {t(lang, "refresh")}
            </button>
          </div>
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
                    await loadList();
                    await onAccountsChanged();
                  } catch (e) {
                    onError(String(e));
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
                    await loadList();
                    await onAccountsChanged();
                  } catch (e) {
                    onError(String(e));
                  }
                }}
              >
                {c.cancel_label || t(lang, "deny")}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (mode === "mafile") {
    return (
      <div className="panel">
        <h2 className="page-title">{t(lang, "importMafileTitle")}</h2>
        <p className="muted page-lead">{t(lang, "confirmationsUseMafileHint")}</p>
        <div className="row-actions">
          <button className="primary-btn" disabled={busy} onClick={() => void pickMaFile()}>
            {t(lang, "pickMafile")}
          </button>
          <button className="ghost-btn" onClick={() => void resetToChoice()}>
            {t(lang, "back")}
          </button>
        </div>
        <div>
          <div className="label">{t(lang, "orPasteJson")}</div>
          <textarea
            className="field textarea"
            value={maText}
            onChange={(e) => setMaText(e.target.value)}
            placeholder='{"shared_secret":"...","identity_secret":"...","tokens":{...}}'
          />
        </div>
        <button
          className="primary-btn"
          disabled={busy || !maText.trim()}
          onClick={() => void importMaText()}
        >
          {t(lang, "importAction")}
        </button>
      </div>
    );
  }

  if (mode === "new_setup" && setup) {
    return (
      <div className="panel">
        <h2 className="page-title">{t(lang, "steamSignInTitle")}</h2>
        <form className="stack" onSubmit={submitNewSetup} noValidate>
          <p className="muted">{t(lang, setup.message_key as I18nKey)}</p>
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
            <button type="button" className="ghost-btn" onClick={() => void resetToChoice()}>
              {t(lang, "cancel")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (mode === "login") {
    return (
      <div className="panel">
        <h2 className="page-title">{t(lang, "confirmationsReauth")}</h2>
        {!session ? (
          <form className="stack" onSubmit={beginLogin} noValidate>
            <p className="muted">{t(lang, "confirmationsReauthHint")}</p>
            {accounts.length > 0 ? (
              <div className="account-switcher">
                {(() => {
                  const picker =
                    accounts.find((a) => a.account_name === username) ??
                    accounts.find((a) => a.selected) ??
                    accounts[0];
                  return (
                    <>
                      <button
                        className="account-selector"
                        onClick={() => setShowAccountPicker((v) => !v)}
                        type="button"
                        aria-expanded={showAccountPicker}
                      >
                        <AccountAvatar
                          name={picker.account_name}
                          avatarUrl={picker.avatar_url ?? null}
                        />
                        <div className="account-meta">
                          <div className="account-name">{picker.account_name}</div>
                          <div className="account-sub">
                            {picker.has_session
                              ? t(lang, "sessionActive")
                              : t(lang, "codeOnly")}
                          </div>
                        </div>
                        <span className={`chevron ${showAccountPicker ? "is-open" : ""}`}>
                          <IconChevronDown size={20} />
                        </span>
                      </button>
                      <div
                        className={`dropdown menu-dropdown account-dropdown${showAccountPicker ? " is-open" : ""}`}
                        aria-hidden={!showAccountPicker}
                        inert={!showAccountPicker ? true : undefined}
                      >
                        {accounts.map((a) => (
                          <button
                            key={a.steam_id + a.account_name}
                            type="button"
                            className={
                              a.account_name === username || a.selected ? "active" : ""
                            }
                            onClick={async () => {
                              setShowAccountPicker(false);
                              setUsername(a.account_name);
                              try {
                                await api.accountSelect(a.steam_id);
                                await onAccountsChanged();
                              } catch (e) {
                                onError(String(e));
                              }
                            }}
                          >
                            {a.account_name}
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div>
                <div className="label">{t(lang, "steamUsername")}</div>
                <input
                  className="field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            <div>
              <div className="label">{t(lang, "password")}</div>
              <div className="password-field">
                <input
                  className="field"
                  type={pwVisible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setPwVisible((v) => !v)}
                  aria-label={pwVisible ? t(lang, "hidePassword") : t(lang, "showPassword")}
                >
                  {pwVisible ? <IconEyeSlash /> : <IconEye />}
                </button>
              </div>
            </div>
            <div className="row-actions">
              <button className="primary-btn" disabled={busy || !username.trim() || !password}>
                {busy ? t(lang, "signingIn") : t(lang, "enter")}
              </button>
              <button type="button" className="ghost-btn" onClick={() => void resetToChoice()}>
                {t(lang, "back")}
              </button>
            </div>
          </form>
        ) : (
          <form className="stack" onSubmit={submitSessionCode} noValidate>
            <p className="muted">{t(lang, session.message_key as I18nKey)}</p>
            {session.known_account && liveGuard && (
              <div className="code-block">
                <div className="code-row">
                  <GuardCodeDigits code={liveGuard.code} />
                  <button
                    type="button"
                    className={`copy-btn ${guardCopied ? "copied" : ""}`}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(liveGuard.code);
                        setGuardCopied(true);
                        window.setTimeout(() => setGuardCopied(false), 1200);
                      } catch (e) {
                        onError(String(e));
                      }
                    }}
                    title={t(lang, "copy")}
                  >
                    <IconCopy />
                  </button>
                </div>
                <div className="progress-row">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${(liveGuard.seconds_remaining / 30) * 100}%` }}
                    />
                  </div>
                  <div className="timer">{liveGuard.seconds_remaining}s</div>
                </div>
              </div>
            )}
            {session.needs_code && (
              <div>
                <div className="label">
                  {session.code_label_key
                    ? t(lang, session.code_label_key as I18nKey)
                    : t(lang, "code")}
                </div>
                <input
                  className="field"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
            )}
            <div className="row-actions">
              {session.needs_code ? (
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
                      await handleSessionStatus(await api.steamSessionContinue());
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
              <button type="button" className="ghost-btn" onClick={() => void resetToChoice()}>
                {t(lang, "cancel")}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // choice / auto without session
  return (
    <div className="panel">
      <h2 className="page-title">{t(lang, "confirmationsSetupTitle")}</h2>
      <p className="muted">{t(lang, "confirmationsSetupLead")}</p>
      <div className="choice-grid">
        {accountNeedsReauth(selected) && (
          <button className="choice-tile" onClick={() => setMode("login")}>
            <div className="action-icon">
              <IconLogin />
            </div>
            <div>
              <div className="conf-title">{t(lang, "confirmationsReauth")}</div>
              <div className="conf-summary">{t(lang, "confirmationsReauthHint")}</div>
            </div>
          </button>
        )}
        {accountNeedsMafileImport(selected) && (
          <button className="choice-tile" onClick={() => setMode("mafile")}>
            <div className="action-icon">
              <IconImport />
            </div>
            <div>
              <div className="conf-title">{t(lang, "confirmationsUseMafile")}</div>
              <div className="conf-summary">{t(lang, "confirmationsUseMafileHint")}</div>
            </div>
          </button>
        )}
      </div>
      {accountCanConfirm(selected) && (
        <button
          type="button"
          className="ghost-btn"
          style={{ marginTop: 12 }}
          onClick={() => void loadList()}
        >
          {t(lang, "back")}
        </button>
      )}
    </div>
  );
}
