//! Steam login that refreshes JWT session for an existing vault account
//! (like classic SDA "Login again"), or continues into authenticator setup for a new account.

use serde::{Deserialize, Serialize};
use steamguard::protobufs::steammessages_auth_steamclient::{
    EAuthSessionGuardType, EAuthTokenPlatformType,
};
use steamguard::token::Tokens;
use steamguard::transport::WebApiTransport;
use steamguard::userlogin::{DeviceDetails, UserLogin};

use crate::models::StoredAccount;
use crate::steam::setup::SteamSetupSession;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SessionLoginStatus {
    pub phase: String,
    pub message_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code_label_key: Option<String>,
    pub needs_code: bool,
    /// Account with this login name already exists in the vault (can show local Guard code).
    pub known_account: bool,
    pub account_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steam_id: Option<String>,
    /// Session tokens saved onto an existing vault account — confirmations can work.
    pub finished: bool,
    /// Login succeeded for an unknown account; frontend should continue SMS / link UI via steam_setup_*.
    pub continue_as_new_setup: bool,
}

pub struct SessionLoginSession {
    transport: WebApiTransport,
    login: Option<UserLogin<WebApiTransport>>,
    tokens: Option<Tokens>,
    account_name: String,
    known_account: bool,
    steam_id: Option<String>,
    pub phase: String,
}

fn client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())
}

fn device() -> DeviceDetails {
    DeviceDetails {
        friendly_name: "Custom SDA".into(),
        platform_type: EAuthTokenPlatformType::k_EAuthTokenPlatformType_MobileApp,
        os_type: -500,
        gaming_device_type: 528,
    }
}

fn status(
    phase: &str,
    message_key: &str,
    needs_code: bool,
    known_account: bool,
    account_name: &str,
    steam_id: Option<String>,
    finished: bool,
    continue_as_new_setup: bool,
    code_label_key: Option<&str>,
) -> SessionLoginStatus {
    SessionLoginStatus {
        phase: phase.into(),
        message_key: message_key.into(),
        code_label_key: code_label_key.map(|s| s.into()),
        needs_code,
        known_account,
        account_name: account_name.into(),
        steam_id,
        finished,
        continue_as_new_setup,
    }
}

impl SessionLoginSession {
    pub fn begin(
        account_name: String,
        password: String,
        known: Option<&StoredAccount>,
    ) -> Result<(Self, SessionLoginStatus), String> {
        let known_account = known.is_some();
        let steam_id = known.map(|a| a.steam_id.clone());
        let transport = WebApiTransport::new(client()?);
        let mut login = UserLogin::new(transport.clone(), device());
        let methods = login
            .begin_auth_via_credentials(&account_name, &password)
            .map_err(|e| format!("ошибка входа: {e}"))?;

        let mut needs_code = false;
        let mut message_key = String::new();
        let mut phase = "polling".to_string();

        for method in &methods {
            match method.confirmation_type {
                EAuthSessionGuardType::k_EAuthSessionGuardType_None => {}
                EAuthSessionGuardType::k_EAuthSessionGuardType_DeviceConfirmation
                | EAuthSessionGuardType::k_EAuthSessionGuardType_EmailConfirmation => {
                    phase = "await_confirm".into();
                    message_key = if known_account {
                        "sessionLeadConfirmKnown".into()
                    } else {
                        "setupLeadConfirmMobileOrEmail".into()
                    };
                }
                EAuthSessionGuardType::k_EAuthSessionGuardType_EmailCode => {
                    needs_code = true;
                    phase = "await_code".into();
                    message_key = "setupLeadEmailCode".into();
                }
                EAuthSessionGuardType::k_EAuthSessionGuardType_DeviceCode => {
                    needs_code = true;
                    phase = "await_code".into();
                    message_key = if known_account {
                        "sessionLeadDeviceCodeKnown".into()
                    } else {
                        "setupLeadDeviceCode".into()
                    };
                }
                _ => {}
            }
        }

        if !needs_code && phase == "polling" {
            match login.poll_until_tokens() {
                Ok(tokens) => {
                    let mut session = Self {
                        transport,
                        login: None,
                        tokens: Some(tokens),
                        account_name: account_name.clone(),
                        known_account,
                        steam_id: steam_id.clone(),
                        phase: "logged_in".into(),
                    };
                    let st = session.after_tokens()?;
                    return Ok((session, st));
                }
                Err(_) => {
                    phase = "await_confirm".into();
                    message_key = if known_account {
                        "sessionLeadConfirmKnown".into()
                    } else {
                        "setupLeadWaitConfirmContinue".into()
                    };
                }
            }
        }

        Ok((
            Self {
                transport,
                login: Some(login),
                tokens: None,
                account_name: account_name.clone(),
                known_account,
                steam_id: steam_id.clone(),
                phase: phase.clone(),
            },
            status(
                &phase,
                &message_key,
                needs_code,
                known_account,
                &account_name,
                steam_id,
                false,
                false,
                if needs_code {
                    Some(if known_account {
                        "sessionLabelGuardCode"
                    } else {
                        "code"
                    })
                } else {
                    None
                },
            ),
        ))
    }

    pub fn submit_login_code(&mut self, code: String) -> Result<SessionLoginStatus, String> {
        let login = self
            .login
            .as_mut()
            .ok_or_else(|| "сессия входа не активна".to_string())?;

        let try_types = [
            EAuthSessionGuardType::k_EAuthSessionGuardType_DeviceCode,
            EAuthSessionGuardType::k_EAuthSessionGuardType_EmailCode,
        ];
        let mut ok = false;
        let mut errs = Vec::new();
        for t in try_types {
            match login.submit_steam_guard_code(t, code.clone()) {
                Ok(_) => {
                    ok = true;
                    break;
                }
                Err(e) => errs.push(e.to_string()),
            }
        }
        if !ok {
            return Err(format!("неверный код: {}", errs.join("; ")));
        }

        let tokens = login
            .poll_until_tokens()
            .map_err(|e| format!("не удалось получить токены: {e}"))?;
        self.tokens = Some(tokens);
        self.login = None;
        self.phase = "logged_in".into();
        self.after_tokens()
    }

    pub fn continue_poll(&mut self) -> Result<SessionLoginStatus, String> {
        if self.tokens.is_some() {
            return self.after_tokens();
        }
        let login = self
            .login
            .as_mut()
            .ok_or_else(|| "сессия входа не активна".to_string())?;
        let tokens = login
            .poll_until_tokens()
            .map_err(|e| format!("ожидание входа: {e}"))?;
        self.tokens = Some(tokens);
        self.login = None;
        self.phase = "logged_in".into();
        self.after_tokens()
    }

    fn after_tokens(&mut self) -> Result<SessionLoginStatus, String> {
        if self.known_account {
            self.phase = "session_ready".into();
            return Ok(status(
                "session_ready",
                "sessionLeadRefreshed",
                false,
                true,
                &self.account_name,
                self.steam_id.clone(),
                true,
                false,
                None,
            ));
        }
        // New account: hand off to authenticator link flow.
        self.phase = "handoff_setup".into();
        Ok(status(
            "handoff_setup",
            "sessionLeadNewAccountSetup",
            false,
            false,
            &self.account_name,
            None,
            false,
            true,
            None,
        ))
    }

    /// Take tokens for updating an existing vault account.
    pub fn take_tokens_json(&mut self) -> Result<serde_json::Value, String> {
        let tokens = self
            .tokens
            .take()
            .ok_or_else(|| "нет токенов сессии".to_string())?;
        serde_json::to_value(&tokens).map_err(|e| e.to_string())
    }

    pub fn account_name_ref(&self) -> &str {
        &self.account_name
    }

    pub fn steam_id_opt(&self) -> Option<&String> {
        self.steam_id.as_ref()
    }

    /// Convert into full SteamSetupSession after login (new account path). Caller runs `start_link`.
    pub fn into_setup_session(self) -> Result<SteamSetupSession, String> {
        let tokens = self
            .tokens
            .ok_or_else(|| "нет токенов для привязки".to_string())?;
        Ok(SteamSetupSession::from_tokens(
            self.transport,
            tokens,
            self.account_name,
        ))
    }
}
