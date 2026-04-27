// src/logic/mod.rs
pub mod guild;
pub use guild::{
    get_user_guilds,
    get_guild_members,
    find_guild_by_id,
    join_guild_by_id,
    create_guild,
};

pub mod room;
pub use room::{
    get_guild_rooms,
    get_user_rooms,
    get_room_by_id,
    create_room,
    update_room,
    delete_room,
    create_dm_room,
    RoomData,
    CreateRoomData,
};

pub mod message;
pub use message::{
    get_room_messages,
    send_message,
};

pub mod user;
pub use user::{
    get_current_user,
    get_current_user_simple,
    get_online_guild_members,
    get_user_stats,
    update_user_profile,
    get_user_guilds_with_role,
};