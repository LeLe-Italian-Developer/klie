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
