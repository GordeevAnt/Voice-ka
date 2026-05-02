// src-server/src/ws/manager.rs
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{Mutex, broadcast};
use crate::ws::messages::WsMessage;

type ConnectionId = String;

#[derive(Clone)]
pub struct ConnectionInfo {
    pub user_id: i32,
    pub username: String,
    pub session_token: String,
}

pub struct SubscriptionManager {
    room_subscriptions: Arc<Mutex<HashMap<i32, HashSet<ConnectionId>>>>,
    guild_subscriptions: Arc<Mutex<HashMap<i32, HashSet<ConnectionId>>>>,
    connections: Arc<Mutex<HashMap<ConnectionId, broadcast::Sender<WsMessage>>>>,
    connection_info: Arc<Mutex<HashMap<ConnectionId, ConnectionInfo>>>,
}

impl SubscriptionManager {
    pub fn new() -> Self {
        Self {
            room_subscriptions: Arc::new(Mutex::new(HashMap::new())),
            guild_subscriptions: Arc::new(Mutex::new(HashMap::new())),
            connections: Arc::new(Mutex::new(HashMap::new())),
            connection_info: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn add_connection(
        &self, 
        connection_id: ConnectionId, 
        info: ConnectionInfo
    ) -> broadcast::Receiver<WsMessage> {
        let (tx, rx) = broadcast::channel(100);
        self.connections.lock().await.insert(connection_id.clone(), tx);
        self.connection_info.lock().await.insert(connection_id, info);
        rx
    }

    pub async fn remove_connection(&self, connection_id: &str) {
        let mut connections = self.connections.lock().await;
        connections.remove(connection_id);
        
        let mut conn_info = self.connection_info.lock().await;
        conn_info.remove(connection_id);

        let mut rooms = self.room_subscriptions.lock().await;
        for (_, conns) in rooms.iter_mut() {
            conns.remove(connection_id);
        }

        let mut guilds = self.guild_subscriptions.lock().await;
        for (_, conns) in guilds.iter_mut() {
            conns.remove(connection_id);
        }
    }
    
    // Обновление информации о соединении после аутентификации
    pub async fn update_connection_info(&self, connection_id: &str, info: ConnectionInfo) {
        let mut conn_info = self.connection_info.lock().await;
        conn_info.insert(connection_id.to_string(), info);
    }
    
    // Очистка информации о соединении при выходе
    pub async fn clear_connection_info(&self, connection_id: &str) {
        let mut conn_info = self.connection_info.lock().await;
        if let Some(info) = conn_info.get_mut(connection_id) {
            info.user_id = 0;
            info.username = "anonymous".to_string();
        }
    }
    
    pub async fn get_user_id(&self, connection_id: &str) -> Option<i32> {
        self.connection_info
            .lock()
            .await
            .get(connection_id)
            .map(|info| info.user_id)
    }
    
    pub async fn get_username(&self, connection_id: &str) -> Option<String> {
        self.connection_info
            .lock()
            .await
            .get(connection_id)
            .map(|info| info.username.clone())
    }

    pub async fn subscribe_room(&self, room_id: i32, connection_id: &str) {
        self.room_subscriptions
            .lock()
            .await
            .entry(room_id)
            .or_insert_with(HashSet::new)
            .insert(connection_id.to_string());
    }

    pub async fn unsubscribe_room(&self, room_id: i32, connection_id: &str) {
        if let Some(conns) = self.room_subscriptions.lock().await.get_mut(&room_id) {
            conns.remove(connection_id);
        }
    }

    pub async fn subscribe_guild(&self, guild_id: i32, connection_id: &str) {
        self.guild_subscriptions
            .lock()
            .await
            .entry(guild_id)
            .or_insert_with(HashSet::new)
            .insert(connection_id.to_string());
    }

    pub async fn unsubscribe_guild(&self, guild_id: i32, connection_id: &str) {
        if let Some(conns) = self.guild_subscriptions.lock().await.get_mut(&guild_id) {
            conns.remove(connection_id);
        }
    }
    
    pub async fn broadcast_to_room(&self, room_id: i32, message: WsMessage) {
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

    pub async fn broadcast_to_guild(&self, guild_id: i32, message: WsMessage) {
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
}