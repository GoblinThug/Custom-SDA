use reqwest::blocking::Client;

use crate::models::StoredAccount;
use crate::state::AppState;

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("CustomSDA/4.0")
        .build()
        .map_err(|e| e.to_string())
}

fn valid_steam_id(steam_id: &str) -> bool {
    steam_id.parse::<u64>().ok().filter(|id| *id > 0).is_some()
}

fn extract_tag_value(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = xml.find(&open)? + open.len();
    let rest = &xml[start..];
    let value = if let Some(inner) = rest.strip_prefix("<![CDATA[") {
        let end = inner.find("]]>")?;
        &inner[..end]
    } else {
        let end = rest.find(&close)?;
        rest[..end].trim()
    };
    if value.starts_with("http://") || value.starts_with("https://") {
        Some(value.to_string())
    } else {
        None
    }
}

fn avatar_from_profile_xml(body: &str) -> Option<String> {
    extract_tag_value(body, "avatarFull")
        .or_else(|| extract_tag_value(body, "avatarMedium"))
        .or_else(|| extract_tag_value(body, "avatarIcon"))
}

fn fetch_profile_xml(url: &str) -> Option<String> {
    let client = http_client().ok()?;
    let response = client
        .get(url)
        .header("Referer", "https://steamcommunity.com/")
        .header("Accept", "application/xml,text/xml,*/*;q=0.8")
        .send()
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let body = response.text().ok()?;
    avatar_from_profile_xml(&body)
}

pub fn fetch_avatar_url(steam_id: &str, account_name: &str) -> Option<String> {
    if valid_steam_id(steam_id) {
        let url = format!("https://steamcommunity.com/profiles/{steam_id}/?xml=1");
        if let Some(avatar) = fetch_profile_xml(&url) {
            return Some(avatar);
        }
    }
    let name = account_name.trim();
    if !name.is_empty() {
        let url = format!("https://steamcommunity.com/id/{name}/?xml=1");
        if let Some(avatar) = fetch_profile_xml(&url) {
            return Some(avatar);
        }
    }
    None
}

pub fn ensure_avatar(account: &mut StoredAccount) {
    if account
        .avatar_url
        .as_ref()
        .is_some_and(|u| !u.trim().is_empty())
    {
        return;
    }
    account.avatar_url = fetch_avatar_url(&account.steam_id, &account.account_name);
}

pub fn refresh_missing_avatars(state: &AppState) -> Result<(), String> {
    let changed = state.with_unlocked_mut(|u| {
        let mut changed = false;
        for account in &mut u.data.accounts {
            let missing = account
                .avatar_url
                .as_ref()
                .is_none_or(|url| url.trim().is_empty());
            if !missing {
                continue;
            }
            if let Some(url) = fetch_avatar_url(&account.steam_id, &account.account_name) {
                account.avatar_url = Some(url);
                changed = true;
            }
        }
        Ok(changed)
    })?;
    if changed {
        state.persist()?;
    }
    Ok(())
}
