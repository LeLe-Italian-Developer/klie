#[tauri::command]
fn sync_session_token(token: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<AppState>();
    *state.session_token.lock().unwrap() = Some(token);
    Ok(())
}

/// Anti-Piracy & Sync: Passive Sync on Close
/// Uploads all local messages that might be missing from the cloud.
#[tauri::command]
async fn sync_local_to_cloud(app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<AppState>();
    
    // 1. Get token
    let token = {
        let token_guard = state.session_token.lock().unwrap();
        token_guard.clone().ok_or("Not logged in")?
    };

    // 2. Get all local messages
    let messages: Vec<(String, String, String, String, i64)> = {
        let db_guard = state.db.lock().unwrap();
        let db = db_guard.as_ref().ok_or("Database not unlocked")?;
        let mut stmt = db.prepare("SELECT character_id, conversation_id, role, content, created_at FROM chat_messages_v3")
            .map_err(|e| e.to_string())?;
        
        stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    };

    if messages.is_empty() {
        return Ok(());
    }

    // 3. Push to website API
    let client = reqwest::Client::new();
    let api_url = get_api_base_url();

    for (char_id, conv_id, role, content, _) in messages {
        let _ = client.post(format!("{}/api/desktop/chat/{}/messages", api_url, char_id))
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({
                "role": role,
                "content": content,
                "conversationId": conv_id
            }))
            .send()
            .await;
    }

    Ok(())
}

// ─── Security: PIN & Biometrics ─────────────────────────────────────────────

#[tauri::command]
fn set_app_pin(pin: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    if pin.len() != 6 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err(obfstr!("PIN must be 6 digits").to_string());
    }
    let state = app_handle.state::<AppState>();
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not unlocked")?;
    
    let hashed = sha2::Sha256::digest(pin.as_bytes());
    let hex_hash = format!("{:x}", hashed);

    db.execute("INSERT OR REPLACE INTO local_security (key, value) VALUES ('app_pin_hash', ?1)", params![hex_hash])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn verify_app_pin(pin: String, app_handle: tauri::AppHandle) -> Result<bool, String> {
    let state = app_handle.state::<AppState>();
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not unlocked")?;
    
    let hashed = sha2::Sha256::digest(pin.as_bytes());
    let hex_hash = format!("{:x}", hashed);

    let stored_hash: String = db.query_row(
        "SELECT value FROM local_security WHERE key = 'app_pin_hash'",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    Ok(hex_hash == stored_hash)
}

#[tauri::command]
async fn verify_biometrics(_app_handle: tauri::AppHandle) -> Result<bool, String> {
    // Point 8: Native Biometric prompts simulation
    Ok(true)
}

#[tauri::command]
fn set_screenshot_protection(enabled: bool, _app_handle: tauri::AppHandle) -> Result<(), String> {
