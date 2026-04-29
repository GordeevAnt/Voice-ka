// widgets/Rooms_Online_List.tsx
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWebSocket } from "../features/useWebsocket";
import "./Rooms_Online_List.css";

interface OnlineUser {
    user_id: number;
    username: string;
    avatar: string | null;
    status: string;
}

interface RoomsOnlineListProps {
    guildId?: number;
}

export function Rooms_Online_List({ guildId }: RoomsOnlineListProps) {
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [loading, setLoading] = useState(true);

    // Обработчик изменения статуса пользователя
    const handleUserStatusChanged = useCallback((user: OnlineUser) => {
        console.log('🔄 User status changed:', user);
        setOnlineUsers(prev => {
            if (['online', 'idle', 'dnd'].includes(user.status)) {
                const exists = prev.find(u => u.user_id === user.user_id);
                if (exists) {
                    // Обновляем существующего пользователя
                    return prev.map(u => 
                        u.user_id === user.user_id ? user : u
                    );
                } else {
                    // Добавляем нового онлайн пользователя
                    return [...prev, user];
                }
            } else {
                // Удаляем оффлайн пользователя
                return prev.filter(u => u.user_id !== user.user_id);
            }
        });
    }, []);

    // Используем WebSocket хук с обработчиками
    const { isConnected } = useWebSocket({
        currentGuildId: guildId,
        onUserStatusChanged: handleUserStatusChanged,
    });

    // Загрузка начальных данных
    useEffect(() => {
        if (!guildId) {
            setOnlineUsers([]);
            setLoading(false);
            return;
        }

        const loadOnlineUsers = async () => {
            setLoading(true);
            try {
                const users = await invoke<OnlineUser[]>("get_online_guild_members", { 
                    guildId: guildId
                });
                console.log('📋 Loaded online users:', users);
                setOnlineUsers(users);
            } catch (error) {
                console.error("Ошибка загрузки онлайн пользователей:", error);
                setOnlineUsers([]);
            } finally {
                setLoading(false);
            }
        };

        loadOnlineUsers();
    }, [guildId, isConnected]); // Обновляем при изменении статуса подключения

    // Функции для аватаров
    const getInitials = (username: string) => {
        return username
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

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
                    <div className="no-online-users">Нет пользователей</div>
                ) : (
                    onlineUsers.map((user) => (
                        <div key={user.user_id} className="online-user" title={user.username}>
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.username} className="online-user-avatar" />
                            ) : (
                                <div 
                                    className="online-user-avatar-placeholder"
                                    style={{ backgroundColor: getAvatarColor(user.username) }}
                                >
                                    {getInitials(user.username)}
                                </div>
                            )}
                            <div className="online-user-info">
                                <span className="online-user-name">{user.username}</span>
                                <span className="online-user-status">{user.status}</span>
                            </div>
                            <div className="online-user-status-dot" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}