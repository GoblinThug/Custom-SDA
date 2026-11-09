use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAccount {
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
    /// Optional Steam session JWT (access/refresh) as JSON object from steamguard Tokens.
    pub tokens_json: Option<serde_json::Value>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppEvent {
    pub id: String,
    pub kind: String,
    pub message: String,
    pub time: String,
    pub success: bool,
}

fn default_theme() -> String {
    "dark".into()
}

fn default_palette() -> String {
    "steam".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultSettings {
    pub lock_timeout_secs: u64,
    pub lang: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_palette")]
    pub palette: String,
}

impl Default for VaultSettings {
    fn default() -> Self {
        Self {
            lock_timeout_secs: 0,
            lang: "ru".into(),
            theme: default_theme(),
            palette: default_palette(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStatusDto {
    pub exists: bool,
    pub unlocked: bool,
    pub account_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountDto {
    pub account_name: String,
    pub steam_id: String,
    pub avatar_url: Option<String>,
    pub has_session: bool,
    pub selected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardCodeDto {
    pub code: String,
    pub seconds_remaining: u64,
    pub account_name: String,
    pub steam_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfirmationDto {
    pub id: String,
    pub nonce: String,
    pub headline: String,
    pub summary: Vec<String>,
    pub type_name: String,
    pub icon: Option<String>,
    pub accept_label: String,
    pub cancel_label: String,
    pub creation_time: u64,
}
