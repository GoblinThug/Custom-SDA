use std::io::{Read, Write};
use std::time::{Duration, Instant};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{
    engine::general_purpose::{STANDARD as B64, URL_SAFE_NO_PAD as B64URL},
    Engine,
};
use parking_lot::Mutex;
use rand::Rng;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::models::StoredAccount;
use crate::state::AppState;

const TRANSFER_TTL: Duration = Duration::from_secs(300);
/// Target: QR version ~15–20 ECC-L stays scannable from a phone screen.
const MAX_QR_PAYLOAD_LEN: usize = 1200;

/// Legacy v2 plaintext (full field names). Kept for decrypting old QR codes.
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
struct TransferAccountV2 {
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

/// Compact v3 plaintext: short keys, no avatar, no name/id (taken from envelope).
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
struct TransferAccountV3 {
    /// shared_secret as standard or url-safe base64
    #[serde(rename = "ss")]
    shared_secret: String,
    #[serde(rename = "is", default, skip_serializing_if = "String::is_empty")]
    identity_secret: String,
    #[serde(rename = "d", default, skip_serializing_if = "String::is_empty")]
    device_id: String,
    #[serde(rename = "r", default, skip_serializing_if = "String::is_empty")]
    revocation_code: String,
    #[serde(rename = "sn", default, skip_serializing_if = "String::is_empty")]
    serial_number: String,
    #[serde(rename = "tg", default, skip_serializing_if = "String::is_empty")]
    token_gid: String,
    #[serde(rename = "u", default, skip_serializing_if = "String::is_empty")]
    uri: String,
    #[serde(rename = "s1", default, skip_serializing_if = "String::is_empty")]
    secret_1: String,
}

fn b64_to_url_safe(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if let Ok(bytes) = B64.decode(trimmed) {
        return B64URL.encode(bytes);
    }
    if let Ok(bytes) = B64URL.decode(trimmed) {
        return B64URL.encode(bytes);
    }
    trimmed.to_string()
}

fn b64_to_standard(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if let Ok(bytes) = B64URL.decode(trimmed) {
        return B64.encode(bytes);
    }
    if let Ok(bytes) = B64.decode(trimmed) {
        return B64.encode(bytes);
    }
    trimmed.to_string()
}

impl TransferAccountV3 {
    fn from_stored(a: &StoredAccount) -> Self {
        // Minimal fields for Guard + confirmations — smaller QR, larger modules.
        Self {
            shared_secret: b64_to_url_safe(&a.shared_secret),
            identity_secret: b64_to_url_safe(&a.identity_secret),
            device_id: a.device_id.trim().to_string(),
            revocation_code: a.revocation_code.trim().to_string(),
            serial_number: String::new(),
            token_gid: String::new(),
            uri: String::new(),
            secret_1: String::new(),
        }
    }

    fn into_stored(self, account_name: String, steam_id: String) -> StoredAccount {
        StoredAccount {
            account_name,
            steam_id,
            shared_secret: b64_to_standard(&self.shared_secret),
            identity_secret: b64_to_standard(&self.identity_secret),
            device_id: self.device_id,
            revocation_code: self.revocation_code,
            serial_number: self.serial_number,
            token_gid: self.token_gid,
            uri: self.uri,
            secret_1: b64_to_standard(&self.secret_1),
            tokens_json: None,
            avatar_url: None,
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
    /// Compact JSON for the QR (v3). Prefer this over qr_url for scanning.
    pub qr_payload: String,
    /// Deep link for Telegram / system share (larger — do not put in QR).
    pub qr_url: String,
    pub code: String,
    pub account_name: String,
    pub expires_in_secs: u64,
}

/// Wire format for QR. v2 uses long keys; v3 uses short aliases.
#[derive(Debug, Clone, serde::Deserialize, Serialize)]
pub struct QrEnvelope {
    pub v: u32,
    #[serde(alias = "s")]
    pub salt: String,
    #[serde(alias = "n")]
    pub nonce: String,
    #[serde(alias = "c")]
    pub ciphertext: String,
    #[serde(alias = "a")]
    pub account_name: String,
    #[serde(alias = "i")]
    pub steam_id: String,
}

#[derive(Serialize)]
struct QrEnvelopeV3Wire {
    v: u32,
    s: String,
    n: String,
    c: String,
    a: String,
    i: String,
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

        // No avatar fetch — keeps ciphertext small and QR modules large.
        let slim = TransferAccountV3::from_stored(&account);
        let json = serde_json::to_vec(&slim).map_err(|e| e.to_string())?;
        let plain = zlib_compress(&json)?;
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, plain.as_ref())
            .map_err(|e| e.to_string())?;

        let wire = QrEnvelopeV3Wire {
            v: 3,
            s: B64URL.encode(salt),
            n: B64URL.encode(nonce_bytes),
            c: B64URL.encode(ciphertext),
            a: account.account_name.clone(),
            i: account.steam_id.clone(),
        };
        let qr_payload = serde_json::to_string(&wire).map_err(|e| e.to_string())?;
        let qr_url = format!("customsda://import?d={}", B64URL.encode(qr_payload.as_bytes()));

        if qr_payload.len() > MAX_QR_PAYLOAD_LEN {
            return Err(
                "данные аккаунта слишком большие для одного QR — экспортируйте maFile вручную"
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

fn decode_b64_flexible(value: &str) -> Result<Vec<u8>, String> {
    B64URL
        .decode(value)
        .or_else(|_| B64.decode(value))
        .map_err(|e| e.to_string())
}

pub fn decrypt_qr_payload(code: &str, envelope: &QrEnvelope) -> Result<StoredAccount, String> {
    let salt = decode_b64_flexible(&envelope.salt)?;
    if salt.len() != 16 {
        return Err("неверный QR".into());
    }
    let mut salt_arr = [0u8; 16];
    salt_arr.copy_from_slice(&salt);
    let key = transfer_key(code, &salt_arr);
    let nonce_bytes = decode_b64_flexible(&envelope.nonce)?;
    if nonce_bytes.len() != 12 {
        return Err("неверный QR".into());
    }
    let ciphertext = decode_b64_flexible(&envelope.ciphertext)?;
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

    if envelope.v >= 3 {
        let slim: TransferAccountV3 = serde_json::from_slice(&json).map_err(|e| e.to_string())?;
        return Ok(slim.into_stored(
            envelope.account_name.clone(),
            envelope.steam_id.clone(),
        ));
    }

    let slim: TransferAccountV2 = serde_json::from_slice(&json).map_err(|e| e.to_string())?;
    Ok(StoredAccount {
        account_name: slim.account_name,
        steam_id: slim.steam_id,
        shared_secret: slim.shared_secret,
        identity_secret: slim.identity_secret,
        device_id: slim.device_id,
        revocation_code: slim.revocation_code,
        serial_number: slim.serial_number,
        token_gid: slim.token_gid,
        uri: slim.uri,
        secret_1: slim.secret_1,
        tokens_json: None,
        avatar_url: slim
            .avatar_url
            .filter(|u| !u.trim().is_empty() && u.len() <= 512),
    })
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
