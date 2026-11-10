use serde::{Deserialize, Serialize};
use steamguard::accountlinker::{AccountLinkError, AccountLinker, FinalizeLinkError};
use steamguard::protobufs::steammessages_auth_steamclient::{
    EAuthSessionGuardType, EAuthTokenPlatformType,
};
use steamguard::token::Tokens;
use steamguard::transport::WebApiTransport;
use steamguard::userlogin::{DeviceDetails, UserLogin};
use steamguard::SteamGuardAccount;

use crate::models::StoredAccount;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupStatus {
    pub phase: String,
    /// i18n key for the lead line (frontend `t(lang, message_key)`).
    pub message_key: String,
    /// Optional i18n key for code field label; falls back to generic «code».
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code_label_key: Option<String>,
    pub needs_code: bool,
    pub revocation_code: Option<String>,
}

pub struct SteamSetupSession {
    transport: WebApiTransport,
    login: Option<UserLogin<WebApiTransport>>,
    tokens: Option<Tokens>,
    account: Option<SteamGuardAccount>,
    server_time: u64,
    account_name: String,
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

impl SteamSetupSession {
    /// Continue authenticator linking after credentials login already produced tokens.
    pub fn from_tokens(transport: WebApiTransport, tokens: Tokens, account_name: String) -> Self {
        Self {
            transport,
            login: None,
            tokens: Some(tokens),
            account: None,
            server_time: 0,
            account_name,
            phase: "logged_in".into(),
        }
    }

    pub fn begin(account_name: String, password: String) -> Result<(Self, SetupStatus), String> {
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
                    message_key = "setupLeadConfirmMobileOrEmail".into();
                }
                EAuthSessionGuardType::k_EAuthSessionGuardType_EmailCode => {
                    needs_code = true;
                    phase = "await_code".into();
                    message_key = "setupLeadEmailCode".into();
                }
                EAuthSessionGuardType::k_EAuthSessionGuardType_DeviceCode => {
                    needs_code = true;
                    phase = "await_code".into();
                    message_key = "setupLeadDeviceCode".into();
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
                        account: None,
                        server_time: 0,
                        account_name,
                        phase: "logged_in".into(),
                    };
                    let status = session.start_link()?;
                    return Ok((session, status));
                }
                Err(_) => {
                    phase = "await_confirm".into();
                    message_key = "setupLeadWaitConfirmContinue".into();
                }
            }
        }

        Ok((
            Self {
                transport,
                login: Some(login),
                tokens: None,
                account: None,
                server_time: 0,
                account_name,
                phase: phase.clone(),
            },
            SetupStatus {
                phase,
                message_key,
                code_label_key: None,
                needs_code,
                revocation_code: None,
            },
        ))
    }

    pub fn submit_login_code(&mut self, code: String) -> Result<SetupStatus, String> {
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
        self.start_link()
    }

    pub fn continue_poll(&mut self) -> Result<SetupStatus, String> {
        if self.tokens.is_some() {
            return self.start_link();
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
        self.start_link()
    }

    pub fn start_link(&mut self) -> Result<SetupStatus, String> {
        let tokens = self
            .tokens
            .clone()
            .ok_or_else(|| "нет токенов".to_string())?;
        let mut linker = AccountLinker::new(self.transport.clone(), tokens);

        match linker.link() {
            Ok(success) => {
                use steamguard::ExposeSecret;
                self.server_time = success.server_time();
                let account = success.into_account();
                let revocation = account.revocation_code.expose_secret().to_string();
                self.account = Some(account);
                self.phase = "await_sms".into();
                Ok(SetupStatus {
                    phase: self.phase.clone(),
                    message_key: "setupLeadSmsLink".into(),
                    code_label_key: Some("setupLabelSmsLink".into()),
                    needs_code: true,
                    revocation_code: Some(revocation),
                })
            }
            Err(AccountLinkError::MustProvidePhoneNumber) => {
                self.phase = "await_phone".into();
                Ok(SetupStatus {
                    phase: self.phase.clone(),
                    message_key: "setupLeadNoPhone".into(),
                    code_label_key: None,
                    needs_code: false,
                    revocation_code: None,
                })
            }
            Err(AccountLinkError::MustConfirmEmail) => {
                self.phase = "await_email_confirm".into();
                Ok(SetupStatus {
                    phase: self.phase.clone(),
                    message_key: "setupLeadConfirmSteamEmail".into(),
                    code_label_key: None,
                    needs_code: false,
                    revocation_code: None,
                })
            }
            Err(AccountLinkError::AuthenticatorPresent) => match linker.transfer_start() {
                Ok(()) => {
                    self.phase = "await_transfer_sms".into();
                    Ok(SetupStatus {
                        phase: self.phase.clone(),
                        message_key: "setupLeadTransferSms".into(),
                        code_label_key: Some("setupLabelSmsTransfer".into()),
                        needs_code: true,
                        revocation_code: None,
                    })
                }
                Err(e) => Err(format!(
                    "Authenticator уже привязан. Удалите его в Steam или импортируйте .maFile. ({e})"
                )),
            },
            Err(e) => Err(format!("не удалось начать привязку: {e}")),
        }
    }

    pub fn finalize_sms(&mut self, sms: String) -> Result<StoredAccount, String> {
        let tokens = self
            .tokens
            .clone()
            .ok_or_else(|| "нет токенов".to_string())?;

        if self.phase == "await_transfer_sms" {
            let mut linker = AccountLinker::new(self.transport.clone(), tokens.clone());
            let mut account = linker
                .transfer_finish(&sms)
                .map_err(|e| format!("перенос не удался: {e}"))?;
            account.tokens = Some(tokens);
            return Ok(steamguard_to_stored(account, &self.account_name));
        }

        let mut account = self
            .account
            .take()
            .ok_or_else(|| "нет данных authenticator".to_string())?;
        let mut linker = AccountLinker::new(self.transport.clone(), tokens.clone());
        let mut server_time = self.server_time;
        let mut tries = 0;
        loop {
            match linker.finalize(server_time, &mut account, sms.clone()) {
                Ok(()) => break,
                Err(FinalizeLinkError::WantMore { server_time: s }) => {
                    server_time = s;
                    tries += 1;
                    if tries >= 30 {
                        return Err("не удалось подтвердить привязку authenticator".into());
                    }
                }
                Err(e) => return Err(format!("ошибка SMS: {e}")),
            }
        }
        account.tokens = Some(tokens);
        Ok(steamguard_to_stored(account, &self.account_name))
    }
}

fn steamguard_to_stored(account: SteamGuardAccount, fallback_name: &str) -> StoredAccount {
    let v = serde_json::to_value(&account).unwrap_or_else(|_| serde_json::json!({}));
    let str_field = |keys: &[&str]| -> String {
        for key in keys {
            if let Some(s) = v.get(*key).and_then(|x| x.as_str()) {
                return s.to_string();
            }
            if let Some(n) = v.get(*key).and_then(|x| x.as_u64()) {
                return n.to_string();
            }
        }
        String::new()
    };

    let name = {
        let n = str_field(&["account_name"]);
        if n.is_empty() {
            fallback_name.to_string()
        } else {
            n
        }
    };

    StoredAccount {
        account_name: name,
        steam_id: str_field(&["steam_id"]),
        shared_secret: str_field(&["shared_secret"]),
        identity_secret: str_field(&["identity_secret"]),
        device_id: str_field(&["device_id"]),
        revocation_code: str_field(&["revocation_code"]),
        serial_number: str_field(&["serial_number"]),
        token_gid: str_field(&["token_gid"]),
        uri: str_field(&["uri"]),
        secret_1: str_field(&["secret_1"]),
        tokens_json: v.get("tokens").cloned().filter(|t| !t.is_null()),
        avatar_url: None,
    }
}
