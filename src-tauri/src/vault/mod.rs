use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, ParamsBuilder, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::models::{AppEvent, StoredAccount, VaultSettings};

const VAULT_VERSION: u32 = 1;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("хранилище не найдено")]
    NotFound,
    #[error("неверный пароль или повреждённый файл")]
    BadPassword,
    #[error("хранилище уже существует")]
    AlreadyExists,
    #[error("ошибка ввода-вывода: {0}")]
    Io(#[from] std::io::Error),
    #[error("ошибка сериализации: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("ошибка шифрования")]
    Crypto,
    #[error("{0}")]
    Message(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VaultFile {
    version: u32,
    kdf: String,
    salt: String,
    nonce: String,
    ciphertext: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultData {
    pub accounts: Vec<StoredAccount>,
    pub selected_steamid: Option<String>,
    pub events: Vec<AppEvent>,
    pub settings: VaultSettings,
}

#[derive(Zeroize, ZeroizeOnDrop)]
pub struct VaultKey {
    pub bytes: [u8; KEY_LEN],
}

pub fn vault_path(app_data: &Path) -> PathBuf {
    app_data.join("vault.csda")
}

pub fn exists(path: &Path) -> bool {
    path.exists()
}

pub fn wipe(path: &Path) -> Result<(), VaultError> {
    let siblings = [
        path.to_path_buf(),
        path.with_extension("csda.bak"),
        path.with_extension("csda.tmp"),
    ];
    for file in siblings {
        if file.exists() {
            fs::remove_file(&file)?;
        }
    }
    Ok(())
}

fn argon2() -> Argon2<'static> {
    let params = ParamsBuilder::new()
        .m_cost(19_456)
        .t_cost(2)
        .p_cost(1)
        .output_len(KEY_LEN)
        .build()
        .expect("argon2 params");
    Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params)
}

pub fn derive_key(password: &str, salt: &[u8]) -> Result<VaultKey, VaultError> {
    let mut bytes = [0u8; KEY_LEN];
    argon2()
        .hash_password_into(password.as_bytes(), salt, &mut bytes)
        .map_err(|_| VaultError::Crypto)?;
    Ok(VaultKey { bytes })
}

fn encrypt_bytes(key: &VaultKey, plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), VaultError> {
    let cipher = Aes256Gcm::new_from_slice(&key.bytes).map_err(|_| VaultError::Crypto)?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| VaultError::Crypto)?;
    Ok((nonce_bytes.to_vec(), ciphertext))
}

fn decrypt_bytes(key: &VaultKey, nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, VaultError> {
    let cipher = Aes256Gcm::new_from_slice(&key.bytes).map_err(|_| VaultError::Crypto)?;
    if nonce.len() != NONCE_LEN {
        return Err(VaultError::BadPassword);
    }
    let nonce = Nonce::from_slice(nonce);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| VaultError::BadPassword)
}

pub fn create(path: &Path, password: &str) -> Result<(VaultKey, VaultData), VaultError> {
    if path.exists() {
        return Err(VaultError::AlreadyExists);
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let data = VaultData::default();
    save(path, password, &data)?;
    let (key, data, _) = unlock(path, password)?;
    Ok((key, data))
}

pub fn unlock(path: &Path, password: &str) -> Result<(VaultKey, VaultData, Vec<u8>), VaultError> {
    if !path.exists() {
        return Err(VaultError::NotFound);
    }
    let raw = fs::read_to_string(path)?;
    let file: VaultFile = serde_json::from_str(&raw)?;
    if file.version != VAULT_VERSION || file.kdf != "argon2id" {
        return Err(VaultError::Message(
            "неподдерживаемая версия хранилища".into(),
        ));
    }
    let salt = B64.decode(file.salt).map_err(|_| VaultError::BadPassword)?;
    let nonce = B64.decode(file.nonce).map_err(|_| VaultError::BadPassword)?;
    let ciphertext = B64
        .decode(file.ciphertext)
        .map_err(|_| VaultError::BadPassword)?;
    let key = derive_key(password, &salt)?;
    let plain = decrypt_bytes(&key, &nonce, &ciphertext)?;
    let data: VaultData = serde_json::from_slice(&plain)?;
    Ok((key, data, salt))
}

pub fn save(path: &Path, password: &str, data: &VaultData) -> Result<(), VaultError> {
    let mut salt = [0u8; SALT_LEN];
    // Prefer stable salt if file already exists so password verification stays consistent.
    if path.exists() {
        if let Ok(raw) = fs::read_to_string(path) {
            if let Ok(file) = serde_json::from_str::<VaultFile>(&raw) {
                if let Ok(existing) = B64.decode(file.salt) {
                    if existing.len() == SALT_LEN {
                        salt.copy_from_slice(&existing);
                    } else {
                        rand::thread_rng().fill_bytes(&mut salt);
                    }
                } else {
                    rand::thread_rng().fill_bytes(&mut salt);
                }
            } else {
                rand::thread_rng().fill_bytes(&mut salt);
            }
        } else {
            rand::thread_rng().fill_bytes(&mut salt);
        }
    } else {
        rand::thread_rng().fill_bytes(&mut salt);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
    }

    let key = derive_key(password, &salt)?;
    let plaintext = serde_json::to_vec(data)?;
    let (nonce, ciphertext) = encrypt_bytes(&key, &plaintext)?;
    let file = VaultFile {
        version: VAULT_VERSION,
        kdf: "argon2id".into(),
        salt: B64.encode(salt),
        nonce: B64.encode(nonce),
        ciphertext: B64.encode(ciphertext),
    };
    let json = serde_json::to_string_pretty(&file)?;
    let tmp = path.with_extension("csda.tmp");
    fs::write(&tmp, json)?;
    fs::rename(tmp, path)?;
    Ok(())
}

/// Validate and copy an on-disk vault backup into the live vault path.
pub fn install_backup(source: &Path, dest: &Path, password: &str) -> Result<VaultData, VaultError> {
    let (_key, data, _) = unlock(source, password)?;
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, dest)?;
    Ok(data)
}

pub fn export_contents(source: &Path) -> Result<String, VaultError> {
    if !source.exists() {
        return Err(VaultError::NotFound);
    }
    fs::read_to_string(source).map_err(VaultError::from)
}

/// Import from backup JSON/text via a temp file in the vault directory (writable on mobile).
pub fn install_backup_from_contents(
    dest: &Path,
    contents: &str,
    password: &str,
) -> Result<VaultData, VaultError> {
    let temp = dest.with_extension("csda.import-tmp");
    fs::write(&temp, contents)?;
    let result = install_backup(&temp, dest, password);
    let _ = fs::remove_file(&temp);
    result
}

pub fn export_copy(source: &Path, dest: &Path) -> Result<(), VaultError> {
    if !source.exists() {
        return Err(VaultError::NotFound);
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, dest)?;
    Ok(())
}

pub fn change_password(
    path: &Path,
    old_password: &str,
    new_password: &str,
    data: &VaultData,
) -> Result<VaultKey, VaultError> {
    // Verify old password first.
    let _ = unlock(path, old_password)?;
    // Force new salt by deleting then rewriting.
    let backup = path.with_extension("csda.bak");
    if path.exists() {
        fs::copy(path, &backup)?;
        fs::remove_file(path)?;
    }
    match save(path, new_password, data) {
        Ok(()) => {
            let _ = fs::remove_file(&backup);
            let mut salt = [0u8; SALT_LEN];
            // re-read salt from saved file
            let raw = fs::read_to_string(path)?;
            let file: VaultFile = serde_json::from_str(&raw)?;
            let decoded = B64.decode(file.salt).map_err(|_| VaultError::Crypto)?;
            salt[..decoded.len().min(SALT_LEN)].copy_from_slice(&decoded[..decoded.len().min(SALT_LEN)]);
            derive_key(new_password, &salt)
        }
        Err(e) => {
            if backup.exists() {
                let _ = fs::rename(&backup, path);
            }
            Err(e)
        }
    }
}
