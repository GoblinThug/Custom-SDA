use std::io::{Read, Write};
use std::time::{Duration, Instant};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use parking_lot::Mutex;
use rand::Rng;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::models::StoredAccount;
use crate::state::AppState;

const TRANSFER_TTL: Duration = Duration::from_secs(300);
/// QR v40, ECC-L (byte mode) — запас под рендер на фронте.
const MAX_QR_PAYLOAD_LEN: usize = 2700;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
struct TransferAccount {
    pub account_name: String,
    pub steam_id: String,
    pub shared_secret: String,
    pub identity_secret: String,
    pub device_id: String,
    pub revocation_code: String,
    pub serial_number: String,
    pub token_gid: String,
    pub uri: String,
    pub secret_1: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
}

impl From<&StoredAccount> for TransferAccount {
    fn from(a: &StoredAccount) -> Self {
        Self {
            account_name: a.account_name.clone(),
            steam_id: a.steam_id.clone(),
            shared_secret: a.shared_secret.clone(),
            identity_secret: a.identity_secret.clone(),
            device_id: a.device_id.clone(),
            revocation_code: a.revocation_code.clone(),
            serial_number: a.serial_number.clone(),
            token_gid: a.token_gid.clone(),
            uri: a.uri.clone(),
            secret_1: a.secret_1.clone(),
            avatar_url: a
                .avatar_url
                .as_ref()
                .filter(|u| !u.trim().is_empty() && u.len() <= 512)
                .cloned(),
        }
    }
}

impl From<TransferAccount> for StoredAccount {
    fn from(t: TransferAccount) -> Self {
        StoredAccount {
            account_name: t.account_name,
            steam_id: t.steam_id,
            shared_secret: t.shared_secret,
            identity_secret: t.identity_secret,
            device_id: t.device_id,
            revocation_code: t.revocation_code,
            serial_number: t.serial_number,
            token_gid: t.token_gid,
            uri: t.uri,
            secret_1: t.secret_1,
            tokens_json: None,
            avatar_url: t
                .avatar_url
                .filter(|u| !u.trim().is_empty() && u.len() <= 512),
        }
    }
}

fn zlib_compress(data: &[u8]) -> Result<Vec<u8>, String> {
    use flate2::Compression;
    use flate2::write::ZlibEncoder;
    let mut enc = ZlibEncoder::new(Vec::with_capacity(data.len() / 2 + 32), Compression::best());
    enc.write_all(data).map_err(|e| e.to_string())?;
    enc.finish().map_err(|e| e.to_string())
}

fn zlib_decompress(data: &[u8]) -> Result<Vec<u8>, String> {
    use flate2::read::ZlibDecoder;
    let mut dec = ZlibDecoder::new(data);
    let mut out = Vec::new();
    dec.read_to_end(&mut out).map_err(|e| e.to_string())?;
    Ok(out)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileTransferDto {
    /// Содержимое QR (JSON), без секретов в открытом виде.
    pub qr_payload: String,
    /// Deep link для сканера камеры: customsda://import?d=...
    pub qr_url: String,
    /// Шестизначный код — одинаковый на ПК и телефоне для расшифровки.
    pub code: String,
    pub account_name: String,
    pub expires_in_secs: u64,
}

#[derive(Debug, Clone, serde::Deserialize, Serialize)]
pub struct QrEnvelope {
    v: u32,
    salt: String,
    nonce: String,
    ciphertext: String,
    account_name: String,
    steam_id: String,
}

struct ActiveTransfer {
    code: String,
    created: Instant,
}

pub struct MobileTransferState {
    inner: Mutex<Option<ActiveTransfer>>,
}

impl MobileTransferState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    pub fn prepare(
        &self,
        app_state: &AppState,
        steam_id: Option<String>,
    ) -> Result<MobileTransferDto, String> {
        let account = app_state.with_unlocked(|u| {
            if u.data.accounts.is_empty() {
                return Err("нет аккаунтов".into());
            }
            if let Some(sid) = steam_id {
                u.data
                    .accounts
                    .iter()
                    .find(|a| a.steam_id == sid)
                    .cloned()
                    .ok_or_else(|| "аккаунт не найден".into())
            } else if let Some(sid) = &u.data.selected_steamid {
                u.data
                    .accounts
                    .iter()
                    .find(|a| &a.steam_id == sid)
                    .cloned()
                    .ok_or_else(|| "аккаунт не найден".into())
            } else {
                Ok(u.data.accounts[0].clone())
            }
        })?;

        let code = gen_code();
        let mut salt = [0u8; 16];
        rand::thread_rng().fill(&mut salt);
        let key = transfer_key(&code, &salt);
        let mut account = account;
        crate::steam::avatar::ensure_avatar(&mut account);
        let slim = TransferAccount::from(&account);
        let json = serde_json::to_vec(&slim).map_err(|e| e.to_string())?;
        let plain = zlib_compress(&json)?;
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, plain.as_ref())
            .map_err(|e| e.to_string())?;

        let envelope = QrEnvelope {
            v: 2,
            salt: B64.encode(salt),
            nonce: B64.encode(nonce_bytes),
            ciphertext: B64.encode(ciphertext),
            account_name: account.account_name.clone(),
            steam_id: account.steam_id.clone(),
        };
        let qr_payload = serde_json::to_string(&envelope).map_err(|e| e.to_string())?;
        let qr_url = format!(
            "customsda://import?d={}",
            urlencoding::encode(&qr_payload)
        );

        if qr_url.len() > MAX_QR_PAYLOAD_LEN {
            return Err(
                "данные аккаунта слишком большие для одного QR — сессия Steam не переносится; если ошибка повторяется, экспортируйте maFile вручную"
                    .into(),
            );
        }

        *self.inner.lock() = Some(ActiveTransfer {
            code: code.clone(),
            created: Instant::now(),
        });

        Ok(MobileTransferDto {
            qr_payload,
            qr_url,
            code,
            account_name: account.account_name,
            expires_in_secs: TRANSFER_TTL.as_secs(),
        })
    }

    pub fn verify_code(&self, code: &str) -> Result<(), String> {
        let guard = self.inner.lock();
        let active = guard
            .as_ref()
            .ok_or_else(|| "сначала создайте QR на компьютере".to_string())?;
        if active.created.elapsed() > TRANSFER_TTL {
            return Err("код истёк — обновите QR".into());
        }
        if active.code != code.trim() {
            return Err("код не совпадает с экраном компьютера".into());
        }
        Ok(())
    }
}

impl Default for MobileTransferState {
    fn default() -> Self {
        Self::new()
    }
}

pub fn decrypt_qr_payload(code: &str, envelope: &QrEnvelope) -> Result<StoredAccount, String> {
    let salt = B64.decode(&envelope.salt).map_err(|e| e.to_string())?;
    if salt.len() != 16 {
        return Err("неверный QR".into());
    }
    let mut salt_arr = [0u8; 16];
    salt_arr.copy_from_slice(&salt);
    let key = transfer_key(code, &salt_arr);
    let nonce_bytes = B64.decode(&envelope.nonce).map_err(|e| e.to_string())?;
    if nonce_bytes.len() != 12 {
        return Err("неверный QR".into());
    }
    let ciphertext = B64.decode(&envelope.ciphertext).map_err(|e| e.to_string())?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plain = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "неверный код или повреждённый QR".to_string())?;
    let json = if envelope.v >= 2 {
        zlib_decompress(&plain)?
    } else {
        plain
    };
    let slim: TransferAccount = serde_json::from_slice(&json).map_err(|e| e.to_string())?;
    Ok(StoredAccount::from(slim))
}

fn transfer_key(code: &str, salt: &[u8; 16]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(salt);
    h.update(code.trim().as_bytes());
    h.finalize().into()
}

fn gen_code() -> String {
    format!("{:06}", rand::thread_rng().gen_range(0..1_000_000))
}
