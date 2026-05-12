// pages/Room_Info_Page.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiService } from "../features/api.service";
import { storeAPI } from "../features/useStore";
import { wsService } from "../features/websocket.service";
import { useUserPermissions } from "../features/useUserPermissions";
import "./Info_Pages.css";

interface Room {
    id: number;
    name: string;
    type: string;
    guild_id: number | null;
    topic: string | null;
    position: number | null;
    bitrate: number | null;
    user_limit: number | null;
    created_at: string;
    updated_at: string;
    member_count: number | null;
}

interface RoomUser {
    user_id: number;
    username: string;
    avatar: string | null;
    is_muted: boolean;
    is_deafened: boolean;
    is_streaming: boolean;
}

export function Room_Info_Page() {
    const navigate = useNavigate();
    const location = useLocation();
    const [room, setRoom] = useState<Room | null>(null);
    const [users, setUsers] = useState<RoomUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [roomId, setRoomId] = useState<number>(0);
    const [guildId, setGuildId] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: "",
        topic: "",
        room_type: "text",
        bitrate: 64000,
        user_limit: 0
    });
    
    const { hasEditRooms, isLoading: permissionsLoading } = useUserPermissions(guildId);
    const roomIdRef = useRef(roomId);
    const guildIdRef = useRef(guildId);
    
    useEffect(() => {
        if (!roomId) return;
        
        const unsubscribeRoomUpdated = wsService.on('room_updated', (updatedRoom) => {
            console.log('🔄 Room updated via WS:', updatedRoom);
            if (updatedRoom.id === roomId) {
                // Убедимся, что используем правильное поле для типа комнаты
                const roomType = updatedRoom.type || updatedRoom.room_type;
                setRoom({
                    ...updatedRoom,
                    room_type: roomType
                });
                // Обновляем форму редактирования
                setEditData({
                    name: updatedRoom.name,
                    topic: updatedRoom.topic || "",
                    room_type: roomType || "text",
                    bitrate: updatedRoom.bitrate || 64000,
                    user_limit: updatedRoom.user_limit || 0
                });
            }
        });
        
        return () => {
            unsubscribeRoomUpdated();
        };
    }, [roomId]);

    useEffect(() => {
        roomIdRef.current = roomId;
    }, [roomId]);

    useEffect(() => {
        guildIdRef.current = guildId;
    }, [guildId]);

    useEffect(() => {
        const unsubscribeRoomUpdated = wsService.on('room_updated', (updatedRoom) => {
            console.log('🔄 Room updated via WS:', updatedRoom);
            console.log('Current roomId:', roomIdRef.current);
            console.log('Updated room id:', updatedRoom.id);
            
            if (updatedRoom.id === roomIdRef.current) {
                const roomType = updatedRoom.type || updatedRoom.room_type;
                setRoom(prev => prev ? {
                    ...prev,
                    ...updatedRoom,
                    room_type: roomType
                } : updatedRoom);
                setEditData({
                    name: updatedRoom.name,
                    topic: updatedRoom.topic || "",
                    room_type: roomType || "text",
                    bitrate: updatedRoom.bitrate || 64000,
                    user_limit: updatedRoom.user_limit || 0
                });
            }
        });
        
        return () => {
            unsubscribeRoomUpdated();
        };
    }, []);
    
    useEffect(() => {
        const loadInitialData = async () => {
            await wsService.waitForAuth();
            
            const storedRoomId = await storeAPI.get<number>('current_room_id');
            const storedGuildId = await storeAPI.get<number>('current_guild_id');
            
            if (storedRoomId) {
                setRoomId(storedRoomId);
            }
            if (storedGuildId) {
                setGuildId(storedGuildId);
            }
        };
        
        loadInitialData();
        
    }, []);
    
    useEffect(() => {
        if (guildId) {
            console.log('📡 Room_Info_Page subscribing to guild:', guildId);
            wsService.subscribeGuild(guildId);
        }
        
        return () => {
            if (guildId) {
                console.log('📡 Room_Info_Page unsubscribing from guild:', guildId);
                wsService.unsubscribeGuild(guildId);
            }
        };
    }, [guildId]);

    useEffect(() => {
        if (roomId) {
            loadRoomInfo();
        } else {
            setLoading(false);
        }
    }, [roomId, location.key]);
    
    const loadRoomInfo = async () => {
        if (!roomId) return;

        try {
            const roomData = await apiService.getRoomById(roomId);
            if (roomData) {
                // Используем поле "type" из ответа
                const roomType = roomData.type || roomData.room_type || "text";
                
                const roomWithType = {
                    ...roomData,
                    room_type: roomType
                };
                
                setRoom(roomWithType);
                
                if (!guildId && roomData.guild_id) {
                    console.log('📡 Setting guildId from room data:', roomData.guild_id);
                    setGuildId(roomData.guild_id);
                }
                
                setEditData({
                    name: roomData.name,
                    topic: roomData.topic || "",
                    room_type: roomType,
                    bitrate: roomData.bitrate || 64000,
                    user_limit: roomData.user_limit || 0
                });
            }
        } catch (err) {
            console.error("Ошибка загрузки информации о комнате:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!room || !editData.name.trim()) return;
        
        try {
            const updatedRoom = await apiService.updateRoom(room.id, {
                name: editData.name,
                topic: editData.topic || null,
                type: editData.room_type,
                bitrate: room.type === 'voice' ? editData.bitrate : undefined,
                user_limit: room.type === 'voice' ? editData.user_limit : 0
            });
            
            if (updatedRoom) {
                setRoom(updatedRoom);
                setIsEditing(false);
            } else {
                alert("Ошибка при обновлении комнаты");
            }
        } catch (err) {
            console.error("Error saving room:", err);
            alert(err instanceof Error ? err.message : "Ошибка сохранения");
        }
    };

    const getRoomIcon = (type: string) => {
        switch (type) {
            case 'text': return '💬';
            case 'voice': return '🎙️';
            case 'video': return '📹';
            default: return '💬';
        }
    };

    if (loading || permissionsLoading) {
        return (
            <div className="room-info-page">
                <div className="loading-container">Загрузка...</div>
            </div>
        );
    }

    if (!room) {
        return (
            <div className="room-info-page">
                <div className="error-container">
                    <h2>Комната не выбрана</h2>
                    <button onClick={() => navigate('/main')}>Вернуться назад</button>
                </div>
            </div>
        );
    }

    return (
        <div className="room-info-page">
            <div className="room-info-header">
                <button className="back-btn" onClick={() => navigate('/main')}>← Назад</button>
                <h1>{getRoomIcon(room.type)} {room.name}</h1>
                {hasEditRooms && !isEditing && (
                    <button className="edit-btn" onClick={() => setIsEditing(true)}>
                        Редактировать
                    </button>
                )}
            </div>

            <div className="room-info-content">
                {!isEditing ? (
                    <>
                        <div className="room-details">
                            <div className="detail-item">
                                <label>Тип комнаты:</label>
                                <span className="room-type-badge">{room.type}</span>
                            </div>
                            
                            <div className="detail-item">
                                <label>Тема:</label>
                                <p>{room.topic || "Нет темы"}</p>
                            </div>
                            
                            <div className="detail-item">
                                <label>Создана:</label>
                                <p>{new Date(room.created_at).toLocaleString()}</p>
                            </div>
                            
                            {room.type === 'voice' && (
                                <>
                                    <div className="detail-item">
                                        <label>Битрейт:</label>
                                        <p>{room.bitrate} kbps</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Лимит пользователей:</label>
                                        <p>{room.user_limit === 0 ? "Безлимит" : room.user_limit}</p>
                                    </div>
                                </>
                            )}
                        </div>

                        {users.length > 0 && (
                            <div className="room-users-section">
                                <h3>Пользователи в комнате ({users.length})</h3>
                                <div className="users-list">
                                    {users.map((user) => (
                                        <>
                                            <div key={user.user_id} className="user-item">
                                                <div className="user-avatar">
                                                    {user.avatar ? (
                                                        <img src={user.avatar} alt={user.username} />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {user.username[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="user-info">
                                                    <span className="user-name">{user.username}</span>
                                                    <div className="user-status">
                                                        {user.is_muted && <span className="badge muted">🔇 Заглушен</span>}
                                                        {user.is_deafened && <span className="badge deafened">🔇 Глухой</span>}
                                                        {user.is_streaming && <span className="badge streaming">📺 Стримит</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="edit-room-form">
                        <h3>Редактирование комнаты</h3>
                        
                        <div className="form-group">
                            <label>Название комнаты:</label>
                            <input
                                type="text"
                                value={editData.name}
                                onChange={(e) => setEditData({...editData, name: e.target.value})}
                                maxLength={100}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Тип комнаты:</label>
                            <select
                                value={editData.room_type}
                                onChange={(e) => setEditData({...editData, room_type: e.target.value})}
                            >
                                <option value="text">Текстовая</option>
                                <option value="voice" disabled>Голосовая (скоро)</option>
                                <option value="video" disabled>Видео (скоро)</option>
                            </select>
                            <small>Пока доступны только текстовые комнаты</small>
                        </div>
                        
                        <div className="form-group">
                            <label>Тема:</label>
                            <textarea
                                value={editData.topic}
                                onChange={(e) => setEditData({...editData, topic: e.target.value})}
                                rows={3}
                                maxLength={500}
                            />
                        </div>
                        
                        {room.type === 'voice' && (
                            <>
                                <div className="form-group">
                                    <label>Битрейт (kbps):</label>
                                    <select
                                        value={editData.bitrate}
                                        onChange={(e) => setEditData({...editData, bitrate: parseInt(e.target.value)})}
                                    >
                                        <option value="32000">32 kbps</option>
                                        <option value="64000">64 kbps</option>
                                        <option value="96000">96 kbps</option>
                                        <option value="128000">128 kbps</option>
                                        <option value="256000">256 kbps</option>
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label>Лимит участников:</label>
                                    <input
                                        type="number"
                                        value={editData.user_limit}
                                        onChange={(e) => setEditData({...editData, user_limit: parseInt(e.target.value)})}
                                        min={0}
                                        max={99}
                                    />
                                    <small>0 = безлимит</small>
                                </div>
                            </>
                        )}
                        
                        <div className="form-buttons">
                            <button onClick={() => {
                                setIsEditing(false);
                                setEditData({
                                    name: room.name,
                                    topic: room.topic || "",
                                    room_type: room.type,
                                    bitrate: room.bitrate || 64000,
                                    user_limit: room.user_limit || 0
                                });
                            }} className="cancel-btn">
                                Отмена
                            </button>
                            <button onClick={handleSaveEdit} className="save-btn">
                                Сохранить
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}