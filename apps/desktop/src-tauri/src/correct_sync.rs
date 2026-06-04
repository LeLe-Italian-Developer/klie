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
