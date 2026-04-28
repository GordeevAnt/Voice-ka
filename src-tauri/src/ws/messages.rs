// src-tauri/src/ws/messages.rs
use serde::{Serialize, Deserialize};

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
    pub fn new(message_type: &str, data: serde_json::Value) -> Self {
        Self {
            message_type: message_type.to_string(),
            room_id: None,
            guild_id: None,
            data,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn with_room(mut self, room_id: i32) -> Self {
        self.room_id = Some(room_id);
        self
    }

    pub fn with_guild(mut self, guild_id: i32) -> Self {
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