// src-tauri/src/ws/server.rs
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{SinkExt, StreamExt};
use crate::ws::manager::SubscriptionManager;
use crate::ws::messages::{WsMessage, WsClientMessage};
use crate::db::get_db_pool;

pub async fn start_websocket_server(
    manager: Arc<SubscriptionManager>,
    port: u16,
) -> Result<u16, Box<dyn std::error::Error>> {
    let addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&addr).await?;
    
    let actual_port = listener.local_addr()?.port();
    
    println!("🔌 WebSocket сервер запущен на 127.0.0.1:{}", actual_port);

    while let Ok((stream, addr)) = listener.accept().await {
        println!("📡 Новое соединение от: {}", addr);
        
        let manager = manager.clone();
        
        tokio::spawn(async move {
            if let Ok(ws_stream) = accept_async(stream).await {
                let (mut write, mut read) = ws_stream.split();
                
                let connection_id = uuid::Uuid::new_v4().to_string();
                let mut broadcast_rx = manager.add_connection(connection_id.clone()).await;
                
                // Канал для отправки сообщений из обработчика в write
                let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<tokio_tungstenite::tungstenite::Message>();
                
                // Задача для отправки сообщений клиенту
                let write_task = tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            // Сообщения от обработчика
                            msg = rx.recv() => {
                                match msg {
                                    Some(msg) => {
                                        if let Err(e) = write.send(msg).await {
                                            eprintln!("Ошибка отправки: {}", e);
                                            break;
                                        }
                                    }
                                    None => break,
                                }
                            }
                            // Broadcast сообщения
                            msg = broadcast_rx.recv() => {
                                match msg {
                                    Ok(ws_msg) => {
                                        let text = match serde_json::to_string(&ws_msg) {
                                            Ok(t) => t,
                                            Err(e) => {
                                                eprintln!("Ошибка сериализации: {}", e);
                                                continue;
                                            }
                                        };
                                        if let Err(e) = write.send(tokio_tungstenite::tungstenite::Message::Text(text)).await {
                                            eprintln!("Ошибка отправки broadcast: {}", e);
                                            break;
                                        }
                                    }
                                    Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                                        eprintln!("Пропущено {} сообщений", n);
                                        continue;
                                    }
                                    Err(_) => break,
                                }
                            }
                        }
                    }
                });
                
                // Обработка входящих сообщений
                while let Some(msg_result) = read.next().await {
                    match msg_result {
                        Ok(msg) => {
                            match msg.to_text() {
                                Ok(text) => {
                                    match serde_json::from_str::<WsClientMessage>(text) {
                                        Ok(client_msg) => {
                                            match client_msg.message_type.as_str() {
                                                "ping" => {
                                                    let pong = serde_json::json!({
                                                        "type": "pong",
                                                        "timestamp": chrono::Utc::now().to_rfc3339()
                                                    });
                                                    let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(pong.to_string()));
                                                }
                                                "subscribe_room" => {
                                                    if let Some(room_id) = client_msg.room_id {
                                                        manager.subscribe_room(room_id, &connection_id).await;
                                                        println!("Клиент {} подписался на комнату {}", connection_id, room_id);
                                                    }
                                                }
                                                "unsubscribe_room" => {
                                                    if let Some(room_id) = client_msg.room_id {
                                                        manager.unsubscribe_room(room_id, &connection_id).await;
                                                        println!("Клиент {} отписался от комнаты {}", connection_id, room_id);
                                                    }
                                                }
                                                "subscribe_guild" => {
                                                    if let Some(guild_id) = client_msg.guild_id {
                                                        manager.subscribe_guild(guild_id, &connection_id).await;
                                                        println!("Клиент {} подписался на гильдию {}", connection_id, guild_id);
                                                    }
                                                }
                                                "unsubscribe_guild" => {
                                                    if let Some(guild_id) = client_msg.guild_id {
                                                        manager.unsubscribe_guild(guild_id, &connection_id).await;
                                                        println!("Клиент {} отписался от гильдии {}", connection_id, guild_id);
                                                    }
                                                }
                                                "send_message" => {
                                                    // Обработка отправки сообщения
                                                    if let Some(data) = &client_msg.data {
                                                        if let (Some(room_id), Some(content)) = (
                                                            data.get("room_id").and_then(|v| v.as_i64()),
                                                            data.get("content").and_then(|v| v.as_str()),
                                                        ) {
                                                            // Получаем session_id из данных
                                                            let session_id = data.get("session_id")
                                                                .and_then(|v| v.as_str())
                                                                .unwrap_or("");
                                                            
                                                            // Сохраняем сообщение в БД и отправляем всем
                                                            let pool = get_db_pool();
                                                            
                                                            // Получаем user_id по session_id
                                                            let user_result = sqlx::query!(
                                                                "SELECT u.id, u.username FROM users u \
                                                                 INNER JOIN websocket_sessions ws ON u.id = ws.user_id \
                                                                 WHERE ws.connection_id = $1 AND ws.status = 'active'",
                                                                session_id
                                                            )
                                                            .fetch_optional(pool)
                                                            .await;
                                                            
                                                            if let Ok(Some(user)) = user_result {
                                                                // Вставляем сообщение в БД
                                                                let msg_result = sqlx::query!(
                                                                    "INSERT INTO messages (room_id, user_id, content, attachments) \
                                                                     VALUES ($1, $2, $3, '[]'::jsonb) \
                                                                     RETURNING id, room_id, user_id, content, created_at",
                                                                    room_id as i32,
                                                                    user.id,
                                                                    content
                                                                )
                                                                .fetch_one(pool)
                                                                .await;
                                                                
                                                                if let Ok(msg) = msg_result {
                                                                    let message_data = serde_json::json!({
                                                                        "id": msg.id,
                                                                        "room_id": msg.room_id,
                                                                        "user_id": msg.user_id,
                                                                        "content": msg.content,
                                                                        "author_name": user.username,
                                                                        "created_at": msg.created_at.to_rfc3339(),
                                                                        "attachments": [],
                                                                        "reply_to_id": null,
                                                                        "edited_at": null,
                                                                        "deleted_at": null
                                                                    });
                                                                    
                                                                    // Отправляем сообщение всем в комнате
                                                                    let ws_msg = WsMessage::new(
                                                                        "new_message",
                                                                        message_data
                                                                    ).with_room(room_id as i32);
                                                                    
                                                                    manager.broadcast_to_room(room_id as i32, ws_msg).await;
                                                                }
                                                            } else {
                                                                // Отправляем ошибку клиенту
                                                                let error_msg = serde_json::json!({
                                                                    "type": "error",
                                                                    "data": {
                                                                        "message": "Пользователь не авторизован"
                                                                    }
                                                                });
                                                                let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(error_msg.to_string()));
                                                            }
                                                        }
                                                    }
                                                }
                                                _ => {
                                                    println!("Неизвестный тип сообщения: {}", client_msg.message_type);
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("Ошибка парсинга сообщения: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Ошибка чтения текста: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Ошибка получения сообщения: {}", e);
                            break;
                        }
                    }
                }
                
                // Клиент отключился
                println!("Клиент {} отключился", connection_id);
                manager.remove_connection(&connection_id).await;
                write_task.abort();
            }
        });
    }
    
    Ok(actual_port)
}