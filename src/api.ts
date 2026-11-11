import { invoke } from "@tauri-apps/api/core";

export type VaultStatus = {
  exists: boolean;
  unlocked: boolean;
  account_count: number;
};

export type Account = {
  account_name: string;
  steam_id: string;
  avatar_url: string | null;
  has_session: boolean;
  has_identity: boolean;
  selected: boolean;
};

export type GuardCode = {
  code: string;
  seconds_remaining: number;
  account_name: string;
  steam_id: string;
};

export type AppEvent = {
  id: string;
  kind: string;
  message: string;
  time: string;
  success: boolean;
};

export type Confirmation = {
  id: string;
  nonce: string;
  headline: string;
  summary: string[];
  type_name: string;
  icon: string | null;
  accept_label: string;
  cancel_label: string;
  creation_time: number;
};

export type VaultSettings = {
  lock_timeout_secs: number;
  lang: string;
  theme: string;
  palette: string;
};

export type SetupStatus = {
  phase: string;
  message_key: string;
  code_label_key: string | null;
  needs_code: boolean;
  revocation_code: string | null;
};

export type SessionLoginStatus = {
  phase: string;
  message_key: string;
  code_label_key: string | null;
  needs_code: boolean;
  known_account: boolean;
  account_name: string;
  steam_id: string | null;
  finished: boolean;
  continue_as_new_setup: boolean;
};

export type MobileTransfer = {
  qrPayload: string;
  qrUrl: string;
  code: string;
  accountName: string;
  expiresInSecs: number;
  createdAt: number;
};

export const api = {
  vaultStatus: () => invoke<VaultStatus>("vault_status"),
  vaultCreate: (password: string) => invoke<VaultStatus>("vault_create", { password }),
  vaultUnlock: (password: string) => invoke<VaultStatus>("vault_unlock", { password }),
  vaultLock: () => invoke<VaultStatus>("vault_lock"),
  vaultWipe: () => invoke<VaultStatus>("vault_wipe"),
  vaultChangePassword: (oldPassword: string, newPassword: string) =>
    invoke<void>("vault_change_password", { oldPassword, newPassword }),
  vaultVerifyPassword: (password: string) =>
    invoke<void>("vault_verify_password", { password }),
  vaultExport: (destPath: string) => invoke<void>("vault_export", { destPath }),
  vaultImport: (sourcePath: string, password: string) =>
    invoke<VaultStatus>("vault_import", { sourcePath, password }),
  accountsList: (refreshAvatars = false) =>
    invoke<Account[]>("accounts_list", { refreshAvatars }),
  accountSelect: (steamId: string) => invoke<void>("account_select", { steamId }),
  accountRemove: (steamId: string) => invoke<void>("account_remove", { steamId }),
  guardCode: () => invoke<GuardCode>("guard_code"),
  guardCodeFor: (opts?: { steamId?: string; accountName?: string }) =>
    invoke<GuardCode>("guard_code_for", {
      steamId: opts?.steamId ?? null,
      accountName: opts?.accountName ?? null,
    }),
  importMafile: (path: string) => invoke<Account>("import_mafile", { path }),
  importMafileText: (contents: string) =>
    invoke<Account>("import_mafile_text", { contents }),
  importSharedSecret: (payload: {
    accountName: string;
    steamId: string;
    sharedSecret: string;
    identitySecret: string;
    deviceId: string;
  }) =>
    invoke<Account>("import_shared_secret", {
      accountName: payload.accountName,
      steamId: payload.steamId,
      sharedSecret: payload.sharedSecret,
      identitySecret: payload.identitySecret,
      deviceId: payload.deviceId,
    }),
  confirmationsList: () => invoke<Confirmation[]>("confirmations_list"),
  confirmationAccept: (id: string, nonce: string) =>
    invoke<void>("confirmation_accept", { id, nonce }),
  confirmationDeny: (id: string, nonce: string) =>
    invoke<void>("confirmation_deny", { id, nonce }),
  eventsRecent: () => invoke<AppEvent[]>("events_recent"),
  settingsGet: () => invoke<VaultSettings>("settings_get"),
  settingsSet: (settings: VaultSettings) => invoke<void>("settings_set", { settings }),
  steamSetupBegin: (accountName: string, password: string) =>
    invoke<SetupStatus>("steam_setup_begin", { accountName, password }),
  steamSetupSubmitLoginCode: (code: string) =>
    invoke<SetupStatus>("steam_setup_submit_login_code", { code }),
  steamSetupContinue: () => invoke<SetupStatus>("steam_setup_continue"),
  steamSetupSubmitSms: (sms: string) => invoke<Account>("steam_setup_submit_sms", { sms }),
  steamSetupCancel: () => invoke<void>("steam_setup_cancel"),
  steamSessionBegin: (accountName: string, password: string) =>
    invoke<SessionLoginStatus>("steam_session_begin", { accountName, password }),
  steamSessionSubmitCode: (code: string) =>
    invoke<SessionLoginStatus>("steam_session_submit_code", { code }),
  steamSessionContinue: () => invoke<SessionLoginStatus>("steam_session_continue"),
  steamSessionCancel: () => invoke<void>("steam_session_cancel"),
  mobileTransferPrepare: (steamId?: string) =>
    invoke<Omit<MobileTransfer, "createdAt">>("mobile_transfer_prepare", {
      steamId: steamId ?? null,
    }),
  mobileTransferConfirmCode: (code: string) =>
    invoke<void>("mobile_transfer_confirm_code", { code }),
  mobileTransferImport: (qrPayload: string, code: string) =>
    invoke<Account>("mobile_transfer_import", { qrPayload, code }),
};
