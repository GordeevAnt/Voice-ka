// src-server/src/main.rs
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{SinkExt, StreamExt};
use serde::{Serialize, Deserialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
use tokio::sync::{Mutex, broadcast};
use chrono::Utc;
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use uuid::Uuid;

type ConnectionId = String;

// ========== WebSocket Message Types ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsMessage {
    #[serde(rename = "type")]
    pub message_type: String,
    pub room_id: Option<i32>,
    pub guild_id: Option<i32>,
    pub data: serde_json::Value,
    pub timestamp: String,
}

impl WsMessage {
    fn new(message_type: &str, data: serde_json::Value) -> Self {
        Self {
            message_type: message_type.to_string(),
            room_id: None,
            guild_id: None,
            data,
            timestamp: Utc::now().to_rfc3339(),
        }
    }

    fn with_room(mut self, room_id: i32) -> Self {
        self.room_id = Some(room_id);
        self
    }

    fn with_guild(mut self, guild_id: i32) -> Self {
        self.guild_id = Some(guild_id);
        self
    }
}

#[derive(Debug, Deserialize)]
pub struct WsClientMessage {
    #[serde(rename = "type")]
    pub message_type: String,
    pub room_id: Option<i32>,
    pub guild_id: Option<i32>,
    pub data: Option<serde_json::Value>,
}

// ========== Subscription Manager ==========

pub struct SubscriptionManager {
    room_subscriptions: Arc<Mutex<HashMap<i32, HashSet<ConnectionId>>>>,
    guild_subscriptions: Arc<Mutex<HashMap<i32, HashSet<ConnectionId>>>>,
    connections: Arc<Mutex<HashMap<ConnectionId, broadcast::Sender<WsMessage>>>>,
}

impl SubscriptionManager {
    fn new() -> Self {
        Self {
            room_subscriptions: Arc::new(Mutex::new(HashMap::new())),
            guild_subscriptions: Arc::new(Mutex::new(HashMap::new())),
            connections: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn add_connection(&self, connection_id: ConnectionId) -> broadcast::Receiver<WsMessage> {
        let (tx, rx) = broadcast::channel(100);
        self.connections.lock().await.insert(connection_id, tx);
        rx
    }

    async fn remove_connection(&self, connection_id: &str) {
        let mut connections = self.connections.lock().await;
        connections.remove(connection_id);

        let mut rooms = self.room_subscriptions.lock().await;
        for (_, conns) in rooms.iter_mut() {
            conns.remove(connection_id);
        }

        let mut guilds = self.guild_subscriptions.lock().await;
        for (_, conns) in guilds.iter_mut() {
            conns.remove(connection_id);
        }
    }

    async fn subscribe_room(&self, room_id: i32, connection_id: &str) {
        self.room_subscriptions
            .lock()
            .await
            .entry(room_id)
            .or_insert_with(HashSet::new)
            .insert(connection_id.to_string());
    }

    async fn unsubscribe_room(&self, room_id: i32, connection_id: &str) {
        if let Some(conns) = self.room_subscriptions.lock().await.get_mut(&room_id) {
            conns.remove(connection_id);
        }
    }

    async fn subscribe_guild(&self, guild_id: i32, connection_id: &str) {
        self.guild_subscriptions
            .lock()
            .await
            .entry(guild_id)
            .or_insert_with(HashSet::new)
            .insert(connection_id.to_string());
    }

    async fn unsubscribe_guild(&self, guild_id: i32, connection_id: &str) {
        if let Some(conns) = self.guild_subscriptions.lock().await.get_mut(&guild_id) {
            conns.remove(connection_id);
        }
    }

    async fn broadcast_to_room(&self, room_id: i32, message: WsMessage) {
        let message = message.with_room(room_id);
        let rooms = self.room_subscriptions.lock().await;
        let connections = self.connections.lock().await;

        if let Some(conn_ids) = rooms.get(&room_id) {
            for conn_id in conn_ids {
                if let Some(sender) = connections.get(conn_id) {
                    let _ = sender.send(message.clone());
                }
            }
        }
    }

    async fn broadcast_to_guild(&self, guild_id: i32, message: WsMessage) {
        let message = message.with_guild(guild_id);
        let guilds = self.guild_subscriptions.lock().await;
        let connections = self.connections.lock().await;

        if let Some(conn_ids) = guilds.get(&guild_id) {
            for conn_id in conn_ids {
                if let Some(sender) = connections.get(conn_id) {
                    let _ = sender.send(message.clone());
                }
            }
        }
    }

    async fn send_to_user(&self, connection_id: &str, message: WsMessage) {
        let connections = self.connections.lock().await;
        if let Some(sender) = connections.get(connection_id) {
            let _ = sender.send(message);
        }
    }
}

// ========== Database ==========

static DB_POOL: once_cell::sync::OnceCell<PgPool> = once_cell::sync::OnceCell::new();

async fn init_database() -> Result<&'static PgPool, Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL не установлена в .env файле");
    
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;
    
    DB_POOL.set(pool).unwrap();
    Ok(DB_POOL.get().unwrap())
}

fn get_db_pool() -> &'static PgPool {
    DB_POOL.get().expect("База данных не инициализирована")
}

// ========== Authentication ==========

async fn authenticate_user(session_id: &str, pool: &PgPool) -> Option<(i32, String)> {
    let result = sqlx::query!(
        "SELECT u.id, u.username FROM users u 
            INNER JOIN websocket_sessions ws ON u.id = ws.user_id 
            WHERE ws.connection_id = $1 AND ws.status = 'active'",
        session_id
    )
    .fetch_optional(pool)
    .await
    .ok()?;
    
    result.map(|r| (r.id, r.username))
}

// ========== Message Handler ==========

async fn handle_send_message(
    data: &serde_json::Value,
    manager: Arc<SubscriptionManager>,
    pool: &PgPool,
) {
    let room_id = match data.get("room_id").and_then(|v| v.as_i64()) {
        Some(id) => id,
        None => return,
    };
    let content = match data.get("content").and_then(|v| v.as_str()) {
        Some(c) => c,
        None => return,
    };
    let session_id = match data.get("session_id").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => return,
    };
    
    let user = match authenticate_user(session_id, pool).await {
        Some(u) => u,
        None => return,
    };
    
    let msg_result = sqlx::query!(
        "INSERT INTO messages (room_id, user_id, content, attachments) 
            VALUES ($1, $2, $3, '[]'::jsonb) 
            RETURNING id, room_id, user_id, content, created_at",
        room_id as i32,
        user.0,
        content
    )
    .fetch_one(pool)
    .await
    .ok();
    
    if let Some(msg) = msg_result {
        let message_data = serde_json::json!({
            "id": msg.id,
            "room_id": msg.room_id,
            "user_id": msg.user_id,
            "content": msg.content,
            "author_name": user.1,
            "created_at": msg.created_at.to_rfc3339(),
            "attachments": [],
            "reply_to_id": null,
            "edited_at": null,
            "deleted_at": null
        });
        
        let ws_msg = WsMessage::new("new_message", message_data).with_room(room_id as i32);
        manager.broadcast_to_room(room_id as i32, ws_msg).await;
    }
}

// ========== Main Server ==========

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    
    println!("🚀 Starting Voice-ka WebSocket Server...");
    
    let pool = init_database().await?;
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
        let pool = pool.clone();
        
        tokio::spawn(async move {
            if let Ok(ws_stream) = accept_async(stream).await {
                let (mut write, mut read) = ws_stream.split();
                
                let connection_id = Uuid::new_v4().to_string();
                let mut broadcast_rx = manager.add_connection(connection_id.clone()).await;
                
                let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<tokio_tungstenite::tungstenite::Message>();
                
                let write_task = tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            Some(msg) = rx.recv() => {
                                if write.send(msg).await.is_err() {
                                    break;
                                }
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
                
                while let Some(msg_result) = read.next().await {
                    match msg_result {
                        Ok(msg) => {
                            if let Ok(text) = msg.to_text() {
                                if let Ok(client_msg) = serde_json::from_str::<WsClientMessage>(text) {
                                    match client_msg.message_type.as_str() {
                                        "ping" => {
                                            let pong = serde_json::json!({
                                                "type": "pong",
                                                "timestamp": Utc::now().to_rfc3339()
                                            });
                                            let _ = tx.send(tokio_tungstenite::tungstenite::Message::Text(pong.to_string()));
                                        }
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
                                        "send_message" => {
                                            if let Some(data) = client_msg.data {
                                                handle_send_message(&data, manager.clone(), &pool).await;
                                            }
                                        }
                                        _ => {
                                            println!("Unknown message type: {}", client_msg.message_type);
                                        }
                                    }
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