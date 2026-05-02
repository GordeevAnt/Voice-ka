// src-server/src/handlers/mod.rs
pub mod auth;
pub mod guild;
pub mod message;
pub mod room;

// Экспортируем новые функции из guild
pub use guild::{
    handle_get_user_guilds, 
    handle_create_guild, 
    handle_join_guild, 
    handle_get_guild_members,
    handle_find_guild_by_id,
    handle_get_online_guild_members,
    handle_get_user_guilds_with_role,
    CreateGuildData,
};

// Экспортируем новые функции из room
pub use room::{
    handle_get_guild_rooms,
    handle_create_room,
    handle_get_room_by_id,
    CreateRoomData,
};

// Экспортируем новые функции из auth
pub use auth::{
    handle_login,
    handle_register,
    handle_logout,
    validate_session,
    handle_get_current_user,
    handle_get_user_stats,
    handle_update_user_profile,
    LoginData,
    RegisterData,
};