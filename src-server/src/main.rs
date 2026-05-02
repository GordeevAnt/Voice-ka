// src-server/src/main.rs
mod ws;
mod db;
mod handlers;

use std::sync::Arc;
use serde_json::json;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{SinkExt, StreamExt};
use ws::manager::SubscriptionManager;
use ws::messages::{WsMessage, WsClientMessage};
use handlers::auth::{handle_login, handle_register, handle_logout, validate_session, LoginData, RegisterData};
use handlers::guild::{handle_get_user_guilds, handle_create_guild, handle_join_guild, handle_get_guild_members, CreateGuildData};
use handlers::message::{handle_get_room_messages, handle_send_message};
use handlers::room::{handle_get_guild_rooms, handle_create_room, CreateRoomData};
use uuid::Uuid;
use chrono::Utc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let should_migrate = args.contains(&"--migrate".to_string()) || args.contains(&"-m".to_string());
    
    if should_migrate {
        println!("🚀 Running database migrations...");
        db::init_database().await?;
        println!("✅ Migrations completed!");
        return Ok(());
    }
    
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    println!("🚀 Starting Voice-ka WebSocket Server...");

    db::connect_database().await?;
    println!("✅ Database connected");

    let manager = Arc::new(SubscriptionManager::new());

    let port = std::env::var("WS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(9001);

    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).await?;

    println!("🔌 WebSocket server listening on ws://{}", addr);
    println!("📡 Waiting for connections...");

    while let Ok((stream, addr)) = listener.accept().await {
        println!("📡 New connection from: {}", addr);

        let manager = manager.clone();

        tokio::spawn(async move {
            if let Ok(ws_stream) = accept_async(stream).await {
                let (mut write, mut read) = ws_stream.split();
                let connection_id = Uuid::new_v4().to_string();

                let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

                // НЕ ЖДЕМ АУТЕНТИФИКАЦИЮ СРАЗУ!
                // Просто добавляем соединение без аутентификации
                // Создаем временную информацию о соединении
                let temp_info = ws::manager::ConnectionInfo {
                    user_id: 0,  // Временный ID для неаутентифицированного пользователя
                    username: "anonymous".to_string(),
                    session_token: connection_id.clone(),
                };
                
                let mut broadcast_rx = manager.add_connection(connection_id.clone(), temp_info).await;

                // Отправляем приветственное сообщение
                let welcome_msg = WsMessage::success_response("", json!({
                    "status": "connected",
                    "connection_id": connection_id
                }));
                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                    serde_json::to_string(&welcome_msg).unwrap()
                ));

                // Задача отправки
                let write_task = tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            Some(msg) = rx.recv() => {
                                if write.send(msg).await.is_err() { break; }
                            }
                            Ok(msg) = broadcast_rx.recv() => {
                                if let Ok(text) = serde_json::to_string(&msg) {
                                    if write.send(tokio_tungstenite::tungstenite::Message::Text(text)).await.is_err() {
                                        break;
                                    }
                                }
                            }
                            else => break,
                        }
                    }
                });

                // Обработка сообщений
                while let Some(msg_result) = read.next().await {
                    match msg_result {
                        Ok(msg) => {
                            if let Ok(text) = msg.to_text() {
                                if let Ok(client_msg) = serde_json::from_str::<WsClientMessage>(text) {
                                    // Получаем текущую информацию о соединении
                                    let current_user_id = manager.get_user_id(&connection_id).await;
                                    let current_username = manager.get_username(&connection_id).await;
                                    let request_id = client_msg.request_id.as_deref().unwrap_or("");

                                    match client_msg.message_type.as_str() {
                                        "ping" => {
                                            let pong = json!({ "type": "pong", "timestamp": Utc::now().to_rfc3339() });
                                            let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(pong.to_string()));
                                        }

                                        // АУТЕНТИФИКАЦИЯ (теперь обрабатывается как обычный запрос)
                                        "auth" => {
                                            if let Some(data) = client_msg.data {
                                                if let Some(token) = data.get("session_token").and_then(|v| v.as_str()) {
                                                    if let Some(info) = validate_session(token).await {
                                                        // Обновляем информацию о соединении
                                                        manager.update_connection_info(&connection_id, info.clone()).await;
                                                        
                                                        let resp = WsMessage::success_response(request_id, json!({
                                                            "success": true,
                                                            "user_id": info.user_id,
                                                            "username": info.username
                                                        }));
                                                        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                            serde_json::to_string(&resp).unwrap()
                                                        ));
                                                        
                                                        println!("✅ User {} (ID: {}) authenticated on connection {}", 
                                                                info.username, info.user_id, connection_id);
                                                    } else {
                                                        let resp = WsMessage::error_response(request_id, "Invalid session token");
                                                        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                            serde_json::to_string(&resp).unwrap()
                                                        ));
                                                    }
                                                }
                                            }
                                        }

                                        // AUTH - LOGIN
                                        "login" => {
                                            if let Some(data) = client_msg.data {
                                                if let Ok(login_data) = serde_json::from_value::<LoginData>(data) {
                                                    match handle_login(login_data).await {
                                                        Ok(response) => {
                                                            let resp = WsMessage::success_response(request_id, serde_json::to_value(&response).unwrap());
                                                            let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                serde_json::to_string(&resp).unwrap()
                                                            ));
                                                        }
                                                        Err(e) => {
                                                            let resp = WsMessage::error_response(request_id, &e);
                                                            let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                serde_json::to_string(&resp).unwrap()
                                                            ));
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // AUTH - REGISTER
                                        "register" => {
                                            if let Some(data) = client_msg.data {
                                                if let Ok(reg_data) = serde_json::from_value::<RegisterData>(data) {
                                                    match handle_register(reg_data).await {
                                                        Ok((success, user_id)) => {
                                                            let resp = WsMessage::success_response(request_id, json!({ "success": success, "user_id": user_id }));
                                                            let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                serde_json::to_string(&resp).unwrap()
                                                            ));
                                                        }
                                                        Err(e) => {
                                                            let resp = WsMessage::error_response(request_id, &e);
                                                            let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                serde_json::to_string(&resp).unwrap()
                                                            ));
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // LOGOUT
                                        "logout" => {
                                            if let Some(uid) = current_user_id {
                                                match handle_logout(uid, client_msg.session_token).await {
                                                    Ok(_) => {
                                                        // Сбрасываем информацию о соединении
                                                        manager.clear_connection_info(&connection_id).await;
                                                        
                                                        let resp = WsMessage::success_response(request_id, json!({ "success": true }));
                                                        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                            serde_json::to_string(&resp).unwrap()
                                                        ));
                                                    }
                                                    Err(e) => {
                                                        let resp = WsMessage::error_response(request_id, &e);
                                                        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                            serde_json::to_string(&resp).unwrap()
                                                        ));
                                                    }
                                                }
                                            } else {
                                                let resp = WsMessage::error_response(request_id, "Not authenticated");
                                                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                    serde_json::to_string(&resp).unwrap()
                                                ));
                                            }
                                        }

                                        // GUILDS
                                        "get_user_guilds" => {
                                            if let Some(uid) = current_user_id {
                                                if uid > 0 {
                                                    match handle_get_user_guilds(uid).await {
                                                        Ok(guilds) => {
                                                            let resp = WsMessage::success_response(request_id, json!({ "guilds": guilds }));
                                                            let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                serde_json::to_string(&resp).unwrap()
                                                            ));
                                                        }
                                                        Err(e) => {
                                                            let resp = WsMessage::error_response(request_id, &e);
                                                            let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                serde_json::to_string(&resp).unwrap()
                                                            ));
                                                        }
                                                    }
                                                } else {
                                                    let resp = WsMessage::error_response(request_id, "Not authenticated");
                                                    let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                        serde_json::to_string(&resp).unwrap()
                                                    ));
                                                }
                                            }
                                        }

                                        "create_guild" => {
                                            if let (Some(uid), Some(data)) = (current_user_id, client_msg.data) {
                                                if uid > 0 {
                                                    if let Ok(guild_data) = serde_json::from_value::<CreateGuildData>(data) {
                                                        match handle_create_guild(uid, guild_data, manager.clone()).await {
                                                            Ok(guild) => {
                                                                let resp = WsMessage::success_response(request_id, json!({ "guild": guild }));
                                                                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                    serde_json::to_string(&resp).unwrap()
                                                                ));
                                                            }
                                                            Err(e) => {
                                                                let resp = WsMessage::error_response(request_id, &e);
                                                                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                    serde_json::to_string(&resp).unwrap()
                                                                ));
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    let resp = WsMessage::error_response(request_id, "Not authenticated");
                                                    let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                        serde_json::to_string(&resp).unwrap()
                                                    ));
                                                }
                                            }
                                        }

                                        "join_guild" => {
                                            if let (Some(uid), Some(data)) = (current_user_id, client_msg.data) {
                                                if uid > 0 {
                                                    if let Some(guild_id) = data.get("guild_id").and_then(|v| v.as_i64()) {
                                                        match handle_join_guild(uid, guild_id as i32, manager.clone()).await {
                                                            Ok(success) => {
                                                                let resp = WsMessage::success_response(request_id, json!({ "success": success }));
                                                                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                    serde_json::to_string(&resp).unwrap()
                                                                ));
                                                            }
                                                            Err(e) => {
                                                                let resp = WsMessage::error_response(request_id, &e);
                                                                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                    serde_json::to_string(&resp).unwrap()
                                                                ));
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    let resp = WsMessage::error_response(request_id, "Not authenticated");
                                                    let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                        serde_json::to_string(&resp).unwrap()
                                                    ));
                                                }
                                            }
                                        }

                                        "get_guild_members" => {
                                            if let Some(guild_id) = client_msg.guild_id {
                                                match handle_get_guild_members(guild_id).await {
                                                    Ok(members) => {
                                                        let resp = WsMessage::success_response(request_id, json!({ "members": members }));
                                                        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                            serde_json::to_string(&resp).unwrap()
                                                        ));
                                                    }
                                                    Err(e) => {
                                                        let resp = WsMessage::error_response(request_id, &e);
                                                        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                            serde_json::to_string(&resp).unwrap()
                                                        ));
                                                    }
                                                }
                                            }
                                        }

                                        // ROOMS
                                        "get_guild_rooms" => {
                                            if let Some(guild_id) = client_msg.guild_id {
                                                match handle_get_guild_rooms(guild_id).await {
                                                    Ok(rooms) => {
                                                        let resp = WsMessage::success_response(request_id, json!({ "rooms": rooms }));
                                                        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                            serde_json::to_string(&resp).unwrap()
                                                        ));
                                                    }
                                                    Err(e) => {
                                                        let resp = WsMessage::error_response(request_id, &e);
                                                        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                            serde_json::to_string(&resp).unwrap()
                                                        ));
                                                    }
                                                }
                                            }
                                        }

                                        "create_room" => {
                                            if let (Some(uid), Some(guild_id), Some(data)) = (current_user_id, client_msg.guild_id, client_msg.data) {
                                                if uid > 0 {
                                                    if let Ok(room_data) = serde_json::from_value::<CreateRoomData>(data) {
                                                        match handle_create_room(guild_id, uid, room_data, manager.clone()).await {
                                                            Ok(room) => {
                                                                let resp = WsMessage::success_response(request_id, json!({ "room": room }));
                                                                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                    serde_json::to_string(&resp).unwrap()
                                                                ));
                                                            }
                                                            Err(e) => {
                                                                let resp = WsMessage::error_response(request_id, &e);
                                                                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                    serde_json::to_string(&resp).unwrap()
                                                                ));
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    let resp = WsMessage::error_response(request_id, "Not authenticated");
                                                    let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                        serde_json::to_string(&resp).unwrap()
                                                    ));
                                                }
                                            }
                                        }

                                        // MESSAGES
                                        "get_room_messages" => {
                                            if let Some(room_id) = client_msg.room_id {
                                                match handle_get_room_messages(room_id).await {
                                                    Ok(messages) => {
                                                        let resp = WsMessage::success_response(request_id, json!({ "messages": messages, "room_id": room_id }));
                                                        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                            serde_json::to_string(&resp).unwrap()
                                                        ));
                                                    }
                                                    Err(e) => {
                                                        let resp = WsMessage::error_response(request_id, &e);
                                                        let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                            serde_json::to_string(&resp).unwrap()
                                                        ));
                                                    }
                                                }
                                            }
                                        }

                                        "send_message" => {
                                            if let (Some(uid), Some(uname), Some(data)) = (current_user_id, current_username, client_msg.data) {
                                                if uid > 0 {
                                                    if let (Some(room_id), Some(content)) = (
                                                        data.get("room_id").and_then(|v| v.as_i64()),
                                                        data.get("content").and_then(|v| v.as_str())
                                                    ) {
                                                        match handle_send_message(uid, &uname, room_id as i32, content, manager.clone()).await {
                                                            Ok(message) => {
                                                                let resp = WsMessage::success_response(request_id, json!({ "message": message }));
                                                                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                    serde_json::to_string(&resp).unwrap()
                                                                ));
                                                            }
                                                            Err(e) => {
                                                                let resp = WsMessage::error_response(request_id, &e);
                                                                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                    serde_json::to_string(&resp).unwrap()
                                                                ));
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    let resp = WsMessage::error_response(request_id, "Not authenticated");
                                                    let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                        serde_json::to_string(&resp).unwrap()
                                                    ));
                                                }
                                            }
                                        }

                                        // SUBSCRIPTIONS
                                        "subscribe_room" => {
                                            if let Some(room_id) = client_msg.room_id {
                                                manager.subscribe_room(room_id, &connection_id).await;
                                                println!("Client {} subscribed to room {}", connection_id, room_id);
                                            }
                                        }

                                        "unsubscribe_room" => {
                                            if let Some(room_id) = client_msg.room_id {
                                                manager.unsubscribe_room(room_id, &connection_id).await;
                                                println!("Client {} unsubscribed from room {}", connection_id, room_id);
                                            }
                                        }

                                        "subscribe_guild" => {
                                            if let Some(guild_id) = client_msg.guild_id {
                                                manager.subscribe_guild(guild_id, &connection_id).await;
                                                println!("Client {} subscribed to guild {}", connection_id, guild_id);
                                            }
                                        }

                                        "unsubscribe_guild" => {
                                            if let Some(guild_id) = client_msg.guild_id {
                                                manager.unsubscribe_guild(guild_id, &connection_id).await;
                                                println!("Client {} unsubscribed from guild {}", connection_id, guild_id);
                                            }
                                        }

                                        _ => {
                                            println!("Unknown message type: {}", client_msg.message_type);
                                            let resp = WsMessage::error_response(request_id, &format!("Unknown message type: {}", client_msg.message_type));
                                            let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(
                                                serde_json::to_string(&resp).unwrap()
                                            ));
                                        }
                                    }
                                } else {
                                    println!("Failed to parse message: {}", text);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Error receiving message: {}", e);
                            break;
                        }
                    }
                }

                println!("Client {} disconnected", connection_id);
                manager.remove_connection(&connection_id).await;
                write_task.abort();
            }
        });
    }

    Ok(())
}