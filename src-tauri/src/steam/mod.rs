pub mod avatar;
pub mod session;
pub mod setup;

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use byteorder::{BigEndian, ByteOrder};
use hmac::{Hmac, Mac};
use sha1::Sha1;
use steamguard::transport::WebApiTransport;
use steamguard::{ConfirmationId, Confirmer, SteamGuardAccount};

use crate::models::{ConfirmationDto, StoredAccount};

type HmacSha1 = Hmac<Sha1>;

const STEAM_CHARS: &[u8] = b"23456789BCDFGHJKMNPQRTVWXY";

pub fn steam_time() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn seconds_remaining(time: u64) -> u64 {
    30 - (time % 30)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn code_is_five_chars() {
        // Deterministic: fixed secret + fixed time window.
        let secret = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            [0u8; 20],
        );
        let code = generate_auth_code(&secret, 1_700_000_000).expect("code");
        assert_eq!(code.len(), 5);
        assert!(code.chars().all(|c| STEAM_CHARS.contains(&(c as u8))));
    }
}

pub fn generate_auth_code(shared_secret_b64: &str, time: u64) -> Result<String, String> {
    let secret = B64
        .decode(shared_secret_b64.trim())
        .map_err(|e| format!("неверный shared_secret: {e}"))?;
    let mut time_bytes = [0u8; 8];
    BigEndian::write_u64(&mut time_bytes, time / 30);
    let mut mac = HmacSha1::new_from_slice(&secret).map_err(|e| format!("HMAC error: {e}"))?;
    mac.update(&time_bytes);
    let hash = mac.finalize().into_bytes();
    let offset = (hash[19] & 0x0f) as usize;
    let mut full_code = BigEndian::read_u32(&hash[offset..offset + 4]) & 0x7fff_ffff;
    let mut code = String::with_capacity(5);
    for _ in 0..5 {
        code.push(STEAM_CHARS[(full_code % STEAM_CHARS.len() as u32) as usize] as char);
        full_code /= STEAM_CHARS.len() as u32;
    }
    Ok(code)
}

pub fn stored_to_steamguard(account: &StoredAccount) -> Result<SteamGuardAccount, String> {
    let sid: u64 = account.steam_id.parse().unwrap_or(0);
    let mut value = serde_json::json!({
        "account_name": account.account_name,
        "steam_id": sid,
        "serial_number": account.serial_number,
        "revocation_code": account.revocation_code,
        "shared_secret": account.shared_secret,
        "token_gid": account.token_gid,
        "identity_secret": account.identity_secret,
        "uri": account.uri,
        "device_id": account.device_id,
        "secret_1": account.secret_1,
        "tokens": null
    });
    if let Some(tokens) = &account.tokens_json {
        value["tokens"] = tokens.clone();
    }
    serde_json::from_value(value).map_err(|e| format!("ошибка аккаунта: {e}"))
}

pub fn list_confirmations(account: &StoredAccount) -> Result<Vec<ConfirmationDto>, String> {
    let sg = stored_to_steamguard(account)?;
    if sg.tokens.is_none() {
        return Err(
            "нет активной Steam-сессии. Импортируйте .maFile с JWT-токенами (формат steamguard-cli)."
                .into(),
        );
    }
    if account.identity_secret.trim().is_empty() {
        return Err("для подтверждений нужен identity_secret".into());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let transport = WebApiTransport::new(client);
    let confirmer = Confirmer::new(transport, &sg);
    let confs = confirmer
        .get_confirmations()
        .map_err(|e| format!("не удалось получить подтверждения: {e}"))?;

    Ok(confs
        .into_iter()
        .map(|c| ConfirmationDto {
            id: c.id,
            nonce: c.nonce,
            headline: c.headline,
            summary: c.summary,
            type_name: c.type_name,
            icon: c.icon,
            accept_label: c.accept,
            cancel_label: c.cancel,
            creation_time: c.creation_time,
        })
        .collect())
}

pub fn respond_confirmation(
    account: &StoredAccount,
    id: &str,
    nonce: &str,
    accept: bool,
) -> Result<(), String> {
    let sg = stored_to_steamguard(account)?;
    if sg.tokens.is_none() {
        return Err("нет активной Steam-сессии".into());
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let transport = WebApiTransport::new(client);
    let confirmer = Confirmer::new(transport, &sg);
    let conf_id = ConfirmationId::new(id, nonce);

    if accept {
        confirmer
            .accept_confirmation(conf_id)
            .map_err(|e| format!("не удалось подтвердить: {e}"))?;
    } else {
        confirmer
            .deny_confirmation(conf_id)
            .map_err(|e| format!("не удалось отклонить: {e}"))?;
    }
    Ok(())
}
