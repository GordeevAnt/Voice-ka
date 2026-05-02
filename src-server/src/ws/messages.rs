// src-server/src/ws/messages.rs
use serde::{Serialize, Deserialize};
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsMessage {
    #[serde(rename = "type")]
    pub message_type: String,
    pub request_id: Option<String>,     // 👈 НОВОЕ - для ответов на запросы
    pub success: Option<bool>,           // 👈 НОВОЕ
    pub error: Option<String>,           // 👈 НОВОЕ
    pub room_id: Option<i32>,
    pub guild_id: Option<i32>,
    pub data: serde_json::Value,
    pub timestamp: String,
}

impl WsMessage {
    pub fn new(message_type: &str, data: serde_json::Value) -> Self {
        Self {
            message_type: message_type.to_string(),
            request_id: None,
            success: None,
            error: None,
            room_id: None,
            guild_id: None,
            data,
            timestamp: Utc::now().to_rfc3339(),
        }
    }
    
    // 👇 НОВЫЕ МЕТОДЫ ДЛЯ ОТВЕТОВ
    pub fn success_response(request_id: &str, data: serde_json::Value) -> Self {
        Self {
            message_type: "response".to_string(),
            request_id: Some(request_id.to_string()),
            success: Some(true),
            error: None,
            room_id: None,
            guild_id: None,
            data,
            timestamp: Utc::now().to_rfc3339(),
        }
    }
    
    pub fn error_response(request_id: &str, error: &str) -> Self {
        Self {
            message_type: "response".to_string(),
            request_id: Some(request_id.to_string()),
            success: Some(false),
            error: Some(error.to_string()),
            room_id: None,
            guild_id: None,
            data: serde_json::json!({}),
            timestamp: Utc::now().to_rfc3339(),
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

// 👇 РАСШИРЕННОЕ СООБЩЕНИЕ ОТ КЛИЕНТА
#[derive(Debug, Deserialize)]
pub struct WsClientMessage {
    #[serde(rename = "type")]
    pub message_type: String,
    pub request_id: Option<String>,      // 👈 НОВОЕ
    pub session_token: Option<String>,   // 👈 НОВОЕ - для аутентификации
    pub room_id: Option<i32>,
    pub guild_id: Option<i32>,
    pub data: Option<serde_json::Value>,
}