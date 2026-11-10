use std::fs;
use std::sync::Arc;
use tauri::State;
use zeroize::Zeroizing;

use crate::import;
use crate::mobile_transfer::{decrypt_qr_payload, MobileTransferDto, QrEnvelope};
use crate::models::{
    AccountDto, AppEvent, ConfirmationDto, GuardCodeDto, VaultSettings, VaultStatusDto,
};
use crate::state::{map_vault_err, AppState, UnlockedVault};
use crate::steam;
use crate::vault;

#[tauri::command]
pub fn vault_status(state: State<'_, Arc<AppState>>) -> Result<VaultStatusDto, String> {
    let exists = vault::exists(&state.vault_path);
    let unlocked = state.is_unlocked();
    let account_count = if unlocked {
        state.with_unlocked(|u| Ok(u.data.accounts.len()))?
    } else {
        0
    };
    Ok(VaultStatusDto {
        exists,
        unlocked,
        account_count,
    })
}

#[tauri::command]
pub fn vault_create(state: State<'_, Arc<AppState>>, password: String) -> Result<VaultStatusDto, String> {
    if password.len() < 6 {
        return Err("пароль должен быть не короче 6 символов".into());
    }
    let (_key, data) =
        vault::create(&state.vault_path, &password).map_err(map_vault_err)?;
    *state.inner.lock() = Some(UnlockedVault {
        password: Zeroizing::new(password),
        data,
    });
    vault_status(state)
}

#[tauri::command]
pub fn vault_unlock(state: State<'_, Arc<AppState>>, password: String) -> Result<VaultStatusDto, String> {
    let (_key, data, _salt) =
        vault::unlock(&state.vault_path, &password).map_err(map_vault_err)?;
    *state.inner.lock() = Some(UnlockedVault {
        password: Zeroizing::new(password),
        data,
    });
    vault_status(state)
}

#[tauri::command]
pub fn vault_lock(state: State<'_, Arc<AppState>>) -> Result<VaultStatusDto, String> {
    *state.inner.lock() = None;
    vault_status(state)
}

#[tauri::command]
pub fn vault_wipe(state: State<'_, Arc<AppState>>) -> Result<VaultStatusDto, String> {
    *state.inner.lock() = None;
    *state.steam_setup.lock() = None;
    vault::wipe(&state.vault_path).map_err(map_vault_err)?;
    vault_status(state)
}

#[tauri::command]
pub fn vault_verify_password(
    state: State<'_, Arc<AppState>>,
    password: String,
) -> Result<(), String> {
    if !state.is_unlocked() {
        return Err("хранилище заблокировано".into());
    }
    let _ = vault::unlock(&state.vault_path, &password).map_err(map_vault_err)?;
    Ok(())
}

#[tauri::command]
pub fn vault_change_password(
    state: State<'_, Arc<AppState>>,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    if new_password.len() < 6 {
        return Err("новый пароль должен быть не короче 6 символов".into());
    }
    let data = state.with_unlocked(|u| Ok(u.data.clone()))?;
    let _key = vault::change_password(
        &state.vault_path,
        &old_password,
        &new_password,
        &data,
    )
    .map_err(map_vault_err)?;
    *state.inner.lock() = Some(UnlockedVault {
        password: Zeroizing::new(new_password),
        data,
    });
    state.push_event("encryption", "Пароль шифрования изменён", true)?;
    Ok(())
}

fn map_accounts(state: &AppState) -> Result<Vec<AccountDto>, String> {
    state.with_unlocked(|u| {
        let selected = u
            .data
            .selected_steamid
            .clone()
            .or_else(|| u.data.accounts.first().map(|a| a.steam_id.clone()));
        Ok(u.data
            .accounts
            .iter()
            .map(|a| AccountDto {
                account_name: a.account_name.clone(),
                steam_id: a.steam_id.clone(),
                avatar_url: a.avatar_url.clone(),
                has_session: a.tokens_json.is_some(),
                has_identity: !a.identity_secret.trim().is_empty(),
                selected: selected.as_ref() == Some(&a.steam_id),
            })
            .collect())
    })
}

#[tauri::command]
pub async fn accounts_list(
    state: State<'_, Arc<AppState>>,
    refresh_avatars: Option<bool>,
) -> Result<Vec<AccountDto>, String> {
    let app = state.inner().clone();
    let refresh = refresh_avatars.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || {
        if refresh {
            steam::avatar::refresh_missing_avatars(&app)?;
        }
        map_accounts(&app)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn account_select(state: State<'_, Arc<AppState>>, steam_id: String) -> Result<(), String> {
    state.with_unlocked_mut(|u| {
        if !u.data.accounts.iter().any(|a| a.steam_id == steam_id) {
            return Err("аккаунт не найден".into());
        }
        u.data.selected_steamid = Some(steam_id);
        Ok(())
    })?;
    state.persist()
}

#[tauri::command]
pub fn account_remove(state: State<'_, Arc<AppState>>, steam_id: String) -> Result<(), String> {
    state.with_unlocked_mut(|u| {
        let before = u.data.accounts.len();
        u.data.accounts.retain(|a| a.steam_id != steam_id);
        if u.data.accounts.len() == before {
            return Err("аккаунт не найден".into());
        }
        if u.data.selected_steamid.as_ref() == Some(&steam_id) {
            u.data.selected_steamid = u.data.accounts.first().map(|a| a.steam_id.clone());
        }
        Ok(())
    })?;
    state.push_event("account", "Аккаунт удалён", true)
}

#[tauri::command]
pub fn guard_code(state: State<'_, Arc<AppState>>) -> Result<GuardCodeDto, String> {
    let account = state.selected_account()?;
    let time = steam::steam_time();
    let code = steam::generate_auth_code(&account.shared_secret, time)?;
    Ok(GuardCodeDto {
        code,
        seconds_remaining: steam::seconds_remaining(time),
        account_name: account.account_name,
        steam_id: account.steam_id,
    })
}

#[tauri::command]
pub fn import_mafile(state: State<'_, Arc<AppState>>, path: String) -> Result<AccountDto, String> {
    let raw = fs::read_to_string(&path).map_err(|e| format!("не удалось прочитать файл: {e}"))?;
    let account = import::parse_mafile_contents(&raw)?;
    upsert_account(&state, account)
}

#[tauri::command]
pub fn import_mafile_text(
    state: State<'_, Arc<AppState>>,
    contents: String,
) -> Result<AccountDto, String> {
    let account = import::parse_mafile_contents(&contents)?;
    upsert_account(&state, account)
}

#[tauri::command]
pub fn import_shared_secret(
    state: State<'_, Arc<AppState>>,
    account_name: String,
    steam_id: String,
    shared_secret: String,
    identity_secret: String,
    device_id: String,
) -> Result<AccountDto, String> {
    let account = import::from_shared_secret(
        account_name,
        steam_id,
        shared_secret,
        identity_secret,
        device_id,
    )?;
    upsert_account(&state, account)
}

fn upsert_account(
    state: &AppState,
    mut account: crate::models::StoredAccount,
) -> Result<AccountDto, String> {
    steam::avatar::ensure_avatar(&mut account);
    let dto = state.with_unlocked_mut(|u| {
        let merge_into = |existing: &mut crate::models::StoredAccount, incoming: &mut crate::models::StoredAccount| {
            // Keep a live session / identity if the import omitted them (classic maFile).
            if incoming.tokens_json.is_none() {
                incoming.tokens_json = existing.tokens_json.clone();
            }
            if incoming.identity_secret.trim().is_empty()
                && !existing.identity_secret.trim().is_empty()
            {
                incoming.identity_secret = existing.identity_secret.clone();
            }
            if incoming.avatar_url.is_none() {
                incoming.avatar_url = existing.avatar_url.clone();
            }
            *existing = incoming.clone();
        };

        if let Some(existing) = u
            .data
            .accounts
            .iter_mut()
            .find(|a| a.steam_id == account.steam_id && a.steam_id != "0")
        {
            merge_into(existing, &mut account);
        } else if let Some(existing) = u
            .data
            .accounts
            .iter_mut()
            .find(|a| {
                !account.account_name.is_empty()
                    && a.account_name.eq_ignore_ascii_case(&account.account_name)
            })
        {
            merge_into(existing, &mut account);
        } else {
            u.data.accounts.push(account.clone());
        }
        u.data.selected_steamid = Some(account.steam_id.clone());
        Ok(AccountDto {
            account_name: account.account_name.clone(),
            steam_id: account.steam_id.clone(),
            avatar_url: account.avatar_url.clone(),
            has_session: account.tokens_json.is_some(),
            has_identity: !account.identity_secret.trim().is_empty(),
            selected: true,
        })
    })?;
    state.persist()?;
    state.push_event(
        "import",
        &format!("Импортирован аккаунт {}", dto.account_name),
        true,
    )?;
    Ok(dto)
}

#[tauri::command]
pub async fn confirmations_list(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<ConfirmationDto>, String> {
    let account = state.selected_account()?;
    tauri::async_runtime::spawn_blocking(move || steam::list_confirmations(&account))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn confirmation_accept(
    state: State<'_, Arc<AppState>>,
    id: String,
    nonce: String,
) -> Result<(), String> {
    let account = state.selected_account()?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        steam::respond_confirmation(&account, &id, &nonce, true)
    })
    .await
    .map_err(|e| e.to_string())?;
    result?;
    state.push_event("confirmation", "Подтверждение одобрено", true)?;
    Ok(())
}

#[tauri::command]
pub async fn confirmation_deny(
    state: State<'_, Arc<AppState>>,
    id: String,
    nonce: String,
) -> Result<(), String> {
    let account = state.selected_account()?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        steam::respond_confirmation(&account, &id, &nonce, false)
    })
    .await
    .map_err(|e| e.to_string())?;
    result?;
    state.push_event("confirmation", "Подтверждение отклонено", true)?;
    Ok(())
}

#[tauri::command]
pub fn events_recent(state: State<'_, Arc<AppState>>) -> Result<Vec<AppEvent>, String> {
    state.with_unlocked(|u| Ok(u.data.events.clone()))
}

#[tauri::command]
pub fn settings_get(state: State<'_, Arc<AppState>>) -> Result<VaultSettings, String> {
    state.with_unlocked(|u| Ok(u.data.settings.clone()))
}

#[tauri::command]
pub fn settings_set(
    state: State<'_, Arc<AppState>>,
    settings: VaultSettings,
) -> Result<(), String> {
    state.with_unlocked_mut(|u| {
        u.data.settings = settings;
        Ok(())
    })?;
    state.persist()
}

#[tauri::command]
pub fn steam_setup_begin(
    state: State<'_, Arc<AppState>>,
    account_name: String,
    password: String,
) -> Result<steam::setup::SetupStatus, String> {
    let (session, status) = steam::setup::SteamSetupSession::begin(account_name, password)?;
    *state.steam_setup.lock() = Some(session);
    Ok(status)
}

#[tauri::command]
pub fn steam_setup_submit_login_code(
    state: State<'_, Arc<AppState>>,
    code: String,
) -> Result<steam::setup::SetupStatus, String> {
    let mut guard = state.steam_setup.lock();
    let session = guard
        .as_mut()
        .ok_or_else(|| "нет активной сессии настройки".to_string())?;
    session.submit_login_code(code)
}

#[tauri::command]
pub fn steam_setup_continue(
    state: State<'_, Arc<AppState>>,
) -> Result<steam::setup::SetupStatus, String> {
    let mut guard = state.steam_setup.lock();
    let session = guard
        .as_mut()
        .ok_or_else(|| "нет активной сессии настройки".to_string())?;
    if session.phase == "await_email_confirm" || session.phase == "await_phone" {
        session.start_link()
    } else {
        session.continue_poll()
    }
}

#[tauri::command]
pub fn steam_setup_submit_sms(
    state: State<'_, Arc<AppState>>,
    sms: String,
) -> Result<AccountDto, String> {
    let account = {
        let mut guard = state.steam_setup.lock();
        let session = guard
            .as_mut()
            .ok_or_else(|| "нет активной сессии настройки".to_string())?;
        session.finalize_sms(sms)?
    };
    *state.steam_setup.lock() = None;
    upsert_account(&state, account)
}

#[tauri::command]
pub fn steam_setup_cancel(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    *state.steam_setup.lock() = None;
    Ok(())
}

fn find_known_account_by_login(state: &AppState, login: &str) -> Option<crate::models::StoredAccount> {
    let needle = login.trim().to_ascii_lowercase();
    if needle.is_empty() {
        return None;
    }
    state
        .with_unlocked(|u| {
            Ok(u.data
                .accounts
                .iter()
                .find(|a| a.account_name.trim().to_ascii_lowercase() == needle)
                .cloned())
        })
        .ok()
        .flatten()
}

#[tauri::command]
pub fn steam_session_begin(
    state: State<'_, Arc<AppState>>,
    account_name: String,
    password: String,
) -> Result<steam::session::SessionLoginStatus, String> {
    *state.steam_setup.lock() = None;
    let known = find_known_account_by_login(&state, &account_name);
    let (session, status) =
        steam::session::SessionLoginSession::begin(account_name, password, known.as_ref())?;
    // Immediate finish (no 2FA) for known account — persist tokens now.
    if status.finished {
        let mut session = session;
        apply_session_tokens(&state, &mut session)?;
        *state.steam_session.lock() = None;
        return Ok(status);
    }
    if status.continue_as_new_setup {
        let mut setup = session.into_setup_session()?;
        let link_status = setup.start_link()?;
        *state.steam_setup.lock() = Some(setup);
        *state.steam_session.lock() = None;
        return Ok(steam::session::SessionLoginStatus {
            phase: link_status.phase,
            message_key: link_status.message_key,
            code_label_key: link_status.code_label_key,
            needs_code: link_status.needs_code,
            known_account: false,
            account_name: status.account_name,
            steam_id: None,
            finished: false,
            continue_as_new_setup: true,
        });
    }
    *state.steam_session.lock() = Some(session);
    Ok(status)
}

fn apply_session_tokens(
    state: &AppState,
    session: &mut steam::session::SessionLoginSession,
) -> Result<(), String> {
    let tokens = session.take_tokens_json()?;
    let name = session.account_name_ref().to_string();
    let steam_id = session.steam_id_opt().cloned();
    state.with_unlocked_mut(|u| {
        let acc = u
            .data
            .accounts
            .iter_mut()
            .find(|a| {
                a.account_name.trim().eq_ignore_ascii_case(name.trim())
                    || steam_id
                        .as_ref()
                        .is_some_and(|sid| &a.steam_id == sid && sid != "0")
            })
            .ok_or_else(|| "аккаунт не найден в хранилище".to_string())?;
        acc.tokens_json = Some(tokens);
        u.data.selected_steamid = Some(acc.steam_id.clone());
        Ok(())
    })?;
    state.persist()?;
    state.push_event("session", "Steam-сессия обновлена", true)?;
    Ok(())
}

#[tauri::command]
pub fn steam_session_submit_code(
    state: State<'_, Arc<AppState>>,
    code: String,
) -> Result<steam::session::SessionLoginStatus, String> {
    let mut status = {
        let mut guard = state.steam_session.lock();
        let session = guard
            .as_mut()
            .ok_or_else(|| "нет активной сессии входа".to_string())?;
        session.submit_login_code(code)?
    };
    finish_session_status(&state, &mut status)
}

#[tauri::command]
pub fn steam_session_continue(
    state: State<'_, Arc<AppState>>,
) -> Result<steam::session::SessionLoginStatus, String> {
    let mut status = {
        let mut guard = state.steam_session.lock();
        let session = guard
            .as_mut()
            .ok_or_else(|| "нет активной сессии входа".to_string())?;
        session.continue_poll()?
    };
    finish_session_status(&state, &mut status)
}

fn finish_session_status(
    state: &AppState,
    status: &mut steam::session::SessionLoginStatus,
) -> Result<steam::session::SessionLoginStatus, String> {
    if status.finished {
        let mut guard = state.steam_session.lock();
        if let Some(mut session) = guard.take() {
            apply_session_tokens(state, &mut session)?;
        }
        return Ok(status.clone());
    }
    if status.continue_as_new_setup {
        let session = state
            .steam_session
            .lock()
            .take()
            .ok_or_else(|| "нет активной сессии входа".to_string())?;
        let mut setup = session.into_setup_session()?;
        let link_status = setup.start_link()?;
        *state.steam_setup.lock() = Some(setup);
        *status = steam::session::SessionLoginStatus {
            phase: link_status.phase,
            message_key: link_status.message_key,
            code_label_key: link_status.code_label_key,
            needs_code: link_status.needs_code,
            known_account: false,
            account_name: status.account_name.clone(),
            steam_id: None,
            finished: false,
            continue_as_new_setup: true,
        };
        return Ok(status.clone());
    }
    Ok(status.clone())
}

#[tauri::command]
pub fn steam_session_cancel(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    *state.steam_session.lock() = None;
    Ok(())
}

#[tauri::command]
pub fn guard_code_for(
    state: State<'_, Arc<AppState>>,
    steam_id: Option<String>,
    account_name: Option<String>,
) -> Result<GuardCodeDto, String> {
    let account = state.with_unlocked(|u| {
        if let Some(sid) = steam_id.as_ref().filter(|s| !s.is_empty() && *s != "0") {
            if let Some(acc) = u.data.accounts.iter().find(|a| &a.steam_id == sid) {
                return Ok(acc.clone());
            }
        }
        if let Some(name) = account_name.as_ref().map(|s| s.trim().to_ascii_lowercase()) {
            if !name.is_empty() {
                if let Some(acc) = u
                    .data
                    .accounts
                    .iter()
                    .find(|a| a.account_name.trim().to_ascii_lowercase() == name)
                {
                    return Ok(acc.clone());
                }
            }
        }
        Err("аккаунт не найден".into())
    })?;
    let time = steam::steam_time();
    let code = steam::generate_auth_code(&account.shared_secret, time)?;
    Ok(GuardCodeDto {
        code,
        seconds_remaining: steam::seconds_remaining(time),
        account_name: account.account_name,
        steam_id: account.steam_id,
    })
}

#[tauri::command]
pub fn mobile_transfer_prepare(
    state: State<'_, Arc<AppState>>,
    steam_id: Option<String>,
) -> Result<MobileTransferDto, String> {
    state.mobile_transfer.prepare(&state, steam_id)
}

#[tauri::command]
pub fn mobile_transfer_confirm_code(
    state: State<'_, Arc<AppState>>,
    code: String,
) -> Result<(), String> {
    state.mobile_transfer.verify_code(&code)
}

#[tauri::command]
pub async fn mobile_transfer_import(
    state: State<'_, Arc<AppState>>,
    qr_payload: String,
    code: String,
) -> Result<AccountDto, String> {
    let envelope: QrEnvelope =
        serde_json::from_str(&qr_payload).map_err(|_| "неверный QR".to_string())?;
    let account = decrypt_qr_payload(&code, &envelope)?;
    let app = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || upsert_account(&app, account))
        .await
        .map_err(|e| e.to_string())?
}

