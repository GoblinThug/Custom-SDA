use parking_lot::Mutex;
use std::path::PathBuf;
use zeroize::Zeroizing;

use crate::mobile_transfer::MobileTransferState;
use crate::models::{AppEvent, StoredAccount};
use crate::steam::session::SessionLoginSession;
use crate::steam::setup::SteamSetupSession;
use crate::vault::{self, VaultData, VaultError};

pub struct UnlockedVault {
    pub password: Zeroizing<String>,
    pub data: VaultData,
}

pub struct AppState {
    pub vault_path: PathBuf,
    pub inner: Mutex<Option<UnlockedVault>>,
    pub steam_setup: Mutex<Option<SteamSetupSession>>,
    pub steam_session: Mutex<Option<SessionLoginSession>>,
    pub mobile_transfer: MobileTransferState,
}

impl AppState {
    pub fn new(vault_path: PathBuf) -> Self {
        Self {
            vault_path,
            inner: Mutex::new(None),
            steam_setup: Mutex::new(None),
            steam_session: Mutex::new(None),
            mobile_transfer: MobileTransferState::new(),
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.inner.lock().is_some()
    }

    pub fn with_unlocked<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&UnlockedVault) -> Result<T, String>,
    {
        let guard = self.inner.lock();
        let unlocked = guard.as_ref().ok_or_else(|| "хранилище заблокировано".to_string())?;
        f(unlocked)
    }

    pub fn with_unlocked_mut<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&mut UnlockedVault) -> Result<T, String>,
    {
        let mut guard = self.inner.lock();
        let unlocked = guard
            .as_mut()
            .ok_or_else(|| "хранилище заблокировано".to_string())?;
        f(unlocked)
    }

    pub fn persist(&self) -> Result<(), String> {
        let guard = self.inner.lock();
        let unlocked = guard.as_ref().ok_or_else(|| "хранилище заблокировано".to_string())?;
        vault::save(&self.vault_path, unlocked.password.as_str(), &unlocked.data)
            .map_err(|e| e.to_string())
    }

    pub fn push_event(&self, kind: &str, message: &str, success: bool) -> Result<(), String> {
        self.with_unlocked_mut(|u| {
            let now = chrono::Local::now().format("%H:%M").to_string();
            u.data.events.insert(
                0,
                AppEvent {
                    id: format!("{}-{}", now, u.data.events.len()),
                    kind: kind.into(),
                    message: message.into(),
                    time: now,
                    success,
                },
            );
            if u.data.events.len() > 50 {
                u.data.events.truncate(50);
            }
            Ok(())
        })?;
        self.persist()
    }

    pub fn selected_account(&self) -> Result<StoredAccount, String> {
        self.with_unlocked(|u| {
            if u.data.accounts.is_empty() {
                return Err("нет аккаунтов — импортируйте .maFile".into());
            }
            if let Some(sid) = &u.data.selected_steamid {
                if let Some(acc) = u.data.accounts.iter().find(|a| &a.steam_id == sid) {
                    return Ok(acc.clone());
                }
            }
            Ok(u.data.accounts[0].clone())
        })
    }
}

pub fn map_vault_err(e: VaultError) -> String {
    e.to_string()
}
