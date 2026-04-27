// widgets/Rooms_Online_List.tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { storeAPI } from "../features/useStore";
import "./Rooms_Online_List.css";

interface OnlineUser {
    user_id: number;
    username: string;
    avatar: string | null;
    status: string;
}

export function Rooms_Online_List() {
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadOnlineUsers = async () => {
            try {
                const guildId = await storeAPI.get<string>('current_guild_id');
                if (!guildId) {
                    setLoading(false);
                    return;
                }

                const users = await invoke<OnlineUser[]>("get_online_guild_members", { 
                    guildId: parseInt(guildId) 
                });
                
                setOnlineUsers(users);
            } catch (error) {
                console.error("Ошибка загрузки онлайн пользователей:", error);
            } finally {
                setLoading(false);
            }
        };

        loadOnlineUsers();
    }, []);

    // Функция для получения инициалов из имени
    const getInitials = (username: string) => {
        return username
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Функция для получения цвета аватара на основе имени
    const getAvatarColor = (username: string) => {
        const colors = [
            '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
            '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
            '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#f39c12',
            '#d35400', '#c0392b', '#bdc3c7', '#7f8c8d'
        ];
        
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    };

    if (loading) {
        return (
            <div className="rooms-online-list-block">
                <div className="online-users-header">Онлайн</div>
                <div className="rooms-online-list">
                    <div className="loading-text">Загрузка...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="rooms-online-list-block">
            <div className="rooms-online-list">
                {onlineUsers.length === 0 ? (
                    <div className="no-online-users">Нет пользователей онлайн</div>
                ) : (
                    onlineUsers.map((user) => (
                        <div key={user.user_id} className="online-user" title={user.username}>
                            {user.avatar ? (
                                <img 
                                    src={user.avatar} 
                                    alt={user.username}
                                    className="online-user-avatar"
                                />
                            ) : (
                                <div 
                                    className="online-user-avatar-placeholder"
                                    style={{ backgroundColor: getAvatarColor(user.username) }}
                                >
                                    {getInitials(user.username)}
                                </div>
                            )}
                            <div className="online-user-status-dot" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}