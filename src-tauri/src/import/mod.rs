use serde_json::Value;

use crate::models::StoredAccount;

pub fn parse_mafile_contents(raw: &str) -> Result<StoredAccount, String> {
    let trimmed = raw.trim();
    // Encrypted classic SDA files are base64 blobs without JSON — reject clearly.
    if !trimmed.starts_with('{') {
        return Err(
            "файл выглядит зашифрованным (классический SDA). Расшифруйте его в старом SDA и импортируйте .maFile, либо вставьте secrets вручную."
                .into(),
        );
    }

    let value: Value =
        serde_json::from_str(trimmed).map_err(|e| format!("неверный JSON .maFile: {e}"))?;

    // steamguard-cli format
    if value.get("shared_secret").is_some() && value.get("steam_id").is_some() {
        return from_steamguard_json(&value);
    }

    // Classic SDA / SteamAuth format
    from_classic_json(&value)
}

fn str_field(v: &Value, keys: &[&str]) -> String {
    for key in keys {
        if let Some(s) = v.get(*key).and_then(|x| x.as_str()) {
            return s.to_string();
        }
        if let Some(n) = v.get(*key).and_then(|x| x.as_u64()) {
            return n.to_string();
        }
        if let Some(n) = v.get(*key).and_then(|x| x.as_i64()) {
            return n.to_string();
        }
    }
    String::new()
}

fn from_steamguard_json(v: &Value) -> Result<StoredAccount, String> {
    let shared = str_field(v, &["shared_secret"]);
    if shared.is_empty() {
        return Err("в файле нет shared_secret".into());
    }
    let steam_id = str_field(v, &["steam_id", "SteamID", "steamid"]);
    let tokens_json = v.get("tokens").cloned().filter(|t| !t.is_null());

    Ok(StoredAccount {
        account_name: str_field(v, &["account_name", "AccountName"]),
        steam_id: if steam_id.is_empty() {
            "0".into()
        } else {
            steam_id
        },
        shared_secret: shared,
        identity_secret: str_field(v, &["identity_secret"]),
        device_id: str_field(v, &["device_id"]),
        revocation_code: str_field(v, &["revocation_code"]),
        serial_number: str_field(v, &["serial_number"]),
        token_gid: str_field(v, &["token_gid"]),
        uri: str_field(v, &["uri"]),
        secret_1: str_field(v, &["secret_1"]),
        tokens_json,
        avatar_url: None,
    })
}

fn from_classic_json(v: &Value) -> Result<StoredAccount, String> {
    let shared = str_field(v, &["shared_secret", "sharedsecret"]);
    if shared.is_empty() {
        return Err("в файле нет shared_secret".into());
    }

    let session = v.get("Session").or_else(|| v.get("session"));
    let steam_id = session
        .map(|s| str_field(s, &["SteamID", "steamid", "SteamId"]))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| str_field(v, &["steamid", "SteamID", "Session.SteamID"]));

    // Classic OAuth tokens are incompatible with modern JWT Confirmer — leave tokens empty.
    Ok(StoredAccount {
        account_name: str_field(v, &["account_name", "AccountName"]),
        steam_id: if steam_id.is_empty() {
            "0".into()
        } else {
            steam_id
        },
        shared_secret: shared,
        identity_secret: str_field(v, &["identity_secret"]),
        device_id: str_field(v, &["device_id"]),
        revocation_code: str_field(v, &["revocation_code"]),
        serial_number: str_field(v, &["serial_number"]),
        token_gid: str_field(v, &["token_gid"]),
        uri: str_field(v, &["uri"]),
        secret_1: str_field(v, &["secret_1"]),
        tokens_json: None,
        avatar_url: None,
    })
}

pub fn from_shared_secret(
    account_name: String,
    steam_id: String,
    shared_secret: String,
    identity_secret: String,
    device_id: String,
) -> Result<StoredAccount, String> {
    if shared_secret.trim().is_empty() {
        return Err("shared_secret обязателен".into());
    }
    // Validate base64-ish
    let _ = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        shared_secret.trim(),
    )
    .map_err(|e| format!("shared_secret не base64: {e}"))?;

    let device = if device_id.trim().is_empty() {
        format!(
            "android:{}",
            uuid_like()
        )
    } else {
        device_id
    };

    Ok(StoredAccount {
        account_name: if account_name.trim().is_empty() {
            "account".into()
        } else {
            account_name
        },
        steam_id: if steam_id.trim().is_empty() {
            "0".into()
        } else {
            steam_id
        },
        shared_secret: shared_secret.trim().to_string(),
        identity_secret: identity_secret.trim().to_string(),
        device_id: device,
        revocation_code: String::new(),
        serial_number: String::new(),
        token_gid: String::new(),
        uri: String::new(),
        secret_1: String::new(),
        tokens_json: None,
        avatar_url: None,
    })
}

fn uuid_like() -> String {
    use rand::RngCore;
    let mut b = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut b);
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15]
    )
}
