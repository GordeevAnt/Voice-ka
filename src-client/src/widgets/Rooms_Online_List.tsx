// widgets/Rooms_Online_List.tsx
import { useCallback, useEffect, useState } from "react";
import { apiService } from "../features/api.service";
import { wsService } from "../features/websocket.service";
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
                    return prev.map(u => 
                        u.user_id === user.user_id ? user : u
                    );
                } else {
                    return [...prev, user];
                }
            } else {
                return prev.filter(u => u.user_id !== user.user_id);
            }
        });
    }, []);

    useEffect(() => {
        const unsubscribeStatus = wsService.on('user_status_changed', handleUserStatusChanged);
        const unsubscribeOnline = wsService.on('user_online', (user) => {
            handleUserStatusChanged(user);
        });
        const unsubscribeOffline = wsService.on('user_offline', (userId) => {
            setOnlineUsers(prev => prev.filter(u => u.user_id !== userId));
        });
        
        const unsubscribeUserJoined = wsService.on('user_joined_guild', (user) => {
            console.log('👋 User joined guild:', user);
            if (user.status === 'online') {
                setOnlineUsers(prev => {
                    const exists = prev.find(u => u.user_id === user.user_id);
                    if (exists) return prev;
                    return [...prev, user];
                });
            }
        });
        
        // 👇 НОВЫЙ ОБРАБОТЧИК - пользователь покинул гильдию
        const unsubscribeUserLeftGuild = wsService.on('user_left_guild', (data) => {
            console.log('👋 User left guild in online list:', data);
            const { user_id, guild_id: leftGuildId } = data;
            
            // Если это событие для текущей гильдии
            if (leftGuildId === guildId) {
                // Удаляем пользователя из списка онлайн
                setOnlineUsers(prev => prev.filter(user => user.user_id !== user_id));
            }
        });
        
        const unsubscribeProfileUpdated = wsService.on('user_profile_updated', (userData) => {
            console.log('👤 Profile updated in online list:', userData);
            setOnlineUsers(prev => prev.map(user =>
                user.user_id === userData.user_id
                    ? { ...user, username: userData.username, avatar: userData.avatar }
                    : user
            ));
        });

        return () => {
            unsubscribeStatus();
            unsubscribeOnline();
            unsubscribeOffline();
            unsubscribeUserJoined();
            unsubscribeUserLeftGuild();  // 👈 НОВАЯ ОТПИСКА
            unsubscribeProfileUpdated();
        };
    }, [handleUserStatusChanged, guildId]);

    // Загрузка начальных данных через WebSocket
    useEffect(() => {
        if (!guildId) {
            setOnlineUsers([]);
            setLoading(false);
            return;
        }

        const loadOnlineUsers = async () => {
            setLoading(true);
            try {
                await wsService.waitForAuth();
                const users = await apiService.getOnlineGuildMembers(guildId);
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
        
        // Подписываемся на гильдию для получения обновлений статусов
        wsService.subscribeGuild(guildId);
        
        return () => {
            wsService.unsubscribeGuild(guildId);
        };
    }, [guildId]);

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
            <></>
            <div className="rooms-online-list">
                {onlineUsers.length === 0 ? (
                    <div className="no-online-users">Нет пользователей в сети</div>
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
                            <div className={`online-user-status-dot status-${user.status}`} />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}