// pages/Room_Info_Page.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiService } from "../features/api.service";
import { storeAPI } from "../features/useStore";
import { wsService } from "../features/websocket.service";
import { useUserPermissions } from "../features/useUserPermissions";
import "./Info_Pages.css";

interface Room {
    id: number;
    name: string;
    room_type: string;
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
    const [room, setRoom] = useState<Room | null>(null);
    const [users, setUsers] = useState<RoomUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [roomId, setRoomId] = useState<number>(0);
    const [guildId, setGuildId] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: "",
        topic: "",
        bitrate: 64000,
        user_limit: 0
    });
    
    // Получаем права пользователя
    const { hasEditRooms, isLoading: permissionsLoading } = useUserPermissions(guildId);

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
        if (roomId) {
            loadRoomInfo();
        } else {
            setLoading(false);
        }
    }, [roomId]);
    
    const loadRoomInfo = async () => {
        if (!roomId) return;

        try {
            const roomData = await apiService.getRoomById(roomId);
            if (roomData) {
                setRoom(roomData);
                // Если guild_id не был установлен ранее, устанавливаем из данных комнаты
                if (!guildId && roomData.guild_id) {
                    setGuildId(roomData.guild_id);
                }
                setEditData({
                    name: roomData.name,
                    topic: roomData.topic || "",
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
                topic: editData.topic || null,  // используем null вместо undefined
                bitrate: room.room_type === 'voice' ? editData.bitrate : undefined,
                user_limit: room.room_type === 'voice' ? editData.user_limit : 0
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
            default: return '📁';
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
                <h1>{getRoomIcon(room.room_type)} {room.name}</h1>
                {/* Показываем кнопку редактирования только если есть право */}
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
                                <span className="room-type-badge">{room.room_type}</span>
                            </div>
                            
                            <div className="detail-item">
                                <label>Тема:</label>
                                <p>{room.topic || "Нет темы"}</p>
                            </div>
                            
                            <div className="detail-item">
                                <label>Создана:</label>
                                <p>{new Date(room.created_at).toLocaleString()}</p>
                            </div>
                            
                            {room.room_type === 'voice' && (
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
                            <label>Тема:</label>
                            <textarea
                                value={editData.topic}
                                onChange={(e) => setEditData({...editData, topic: e.target.value})}
                                rows={3}
                                maxLength={500}
                            />
                        </div>
                        
                        {room.room_type === 'voice' && (
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