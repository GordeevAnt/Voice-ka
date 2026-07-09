// Rooms_List.tsx
import { useEffect, useState, useCallback, memo } from "react";
import "./Rooms_List.css";
import { apiService } from "../features/api.service";
import { storeAPI } from "../features/useStore";
import { wsService } from "../features/websocket.service";
import { Switch_Room_Button } from "../shared/Switch_Room_Button";
import { useUserPermissions } from "../features/useUserPermissions";

interface RoomData {
    id: number;
    name: string;
    room_type: string;
    type?: string; // Добавляем альтернативное поле
    guild_id: number | null;
    topic: string | null;
    member_count: number | null;
    created_at: string;
    updated_at: string;
}

interface RoomsListProps {
    guildId: number;
    currentRoomId?: number;
    onRoomSelect?: (roomId: number) => void;
}

export const Rooms_List = memo(({ guildId, currentRoomId, onRoomSelect }: RoomsListProps) => {
    const [rooms, setRooms] = useState<RoomData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");
    const [newRoomTopic, setNewRoomTopic] = useState("");
    const [newRoomType, setNewRoomType] = useState<"text" | "voice">("text");
    const [newRoomBitrate, setNewRoomBitrate] = useState<number>(64);
    const [newRoomUserLimit, setNewRoomUserLimit] = useState<number>(0);
    
    // Получаем права пользователя
    const { hasCreateRooms, isLoading: permissionsLoading } = useUserPermissions(guildId);

    useEffect(() => {
        // Подписываемся на события комнат
        const unsubscribeRoomCreated = wsService.on('room_created', (room) => {
            console.log('🆕 Room created via WS:', room);
            if (room.guild_id === guildId) {
                setRooms(prev => {
                    const exists = prev.some(r => r.id === room.id);
                    if (exists) return prev;
                    return [...prev, room];
                });
            }
        });
        
        const unsubscribeRoomUpdated = wsService.on('room_updated', (room) => {
            if (room.guild_id === guildId) {
                setRooms(prev => prev.map(r => r.id === room.id ? room : r));
            }
        });
        
        const unsubscribeRoomDeleted = wsService.on('room_deleted', (data) => {
            if (data.guild_id === guildId) {
                setRooms(prev => prev.filter(r => r.id !== data.room_id));
            }
        });
        
        return () => {
            unsubscribeRoomCreated();
            unsubscribeRoomUpdated();
            unsubscribeRoomDeleted();
        };
    }, [guildId]);

    const loadRooms = useCallback(async () => {
        if (!guildId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            await wsService.waitForAuth();
            const guildRooms = await apiService.getGuildRooms(guildId);
            console.log('📋 Loaded rooms for guild', guildId, ':', guildRooms);
            
            // Нормализуем данные: приводим type к room_type
            const normalizedRooms = guildRooms.map((room: any) => ({
                ...room,
                room_type: room.type || room.room_type || 'text'
            }));
            
            // Сохраняем ВСЕ комнаты, без фильтрации
            setRooms(normalizedRooms);
            
            // 👇 СОХРАНЯЕМ ВСЕ КОМНАТЫ В ХРАНИЛИЩЕ
            await storeAPI.set('guild_rooms', normalizedRooms);
            
            // 👇 СОХРАНЯЕМ ДАННЫЕ ТЕКУЩЕЙ КОМНАТЫ
            const currentRoomId = await storeAPI.get<number>('current_room_id');
            if (currentRoomId) {
                const currentRoom = normalizedRooms.find((r: any) => r.id === currentRoomId);
                if (currentRoom) {
                    await storeAPI.set('current_room_name', currentRoom.name);
                    await storeAPI.set('current_room_type', currentRoom.room_type || 'text');
                    console.log('✅ Saved current room data:', currentRoom.name);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка загрузки комнат");
            console.error("Failed to load rooms:", err);
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        loadRooms();
        
        wsService.subscribeGuild(guildId);
        
        return () => {
            wsService.unsubscribeGuild(guildId);
        };
    }, [loadRooms, guildId]);

    const handleCreateRoom = useCallback(async () => {
        if (!newRoomName.trim()) {
            alert("Введите название комнаты");
            return;
        }
        
        const userId = await storeAPI.get<number>('user_id');
        if (!userId) {
            alert("Пользователь не авторизован");
            return;
        }
        
        const roomData: any = {
            name: newRoomName.trim(),
            room_type: newRoomType,
            topic: newRoomTopic.trim() || null,
            creator_id: userId
        };
        
        // Добавляем параметры для голосовых комнат
        if (newRoomType === 'voice') {
            roomData.bitrate = newRoomBitrate;
            roomData.user_limit = newRoomUserLimit > 0 ? newRoomUserLimit : null;
        } else {
            roomData.bitrate = null;
            roomData.user_limit = null;
        }
        
        console.log('📝 Creating room with data:', roomData);
        
        try {
            await wsService.waitForAuth();
            console.log('✅ Auth OK');
            
            const result = await wsService.request('create_room', roomData, { guild_id: guildId });
            console.log('✅ Room created:', result);
            
            const newRoom = result.room;
            
            setRooms(prev => {
                const exists = prev.some(r => r.id === newRoom.id);
                if (exists) return prev;
                return [...prev, newRoom];
            });
            
            // 👇 СОХРАНЯЕМ ДАННЫЕ НОВОЙ КОМНАТЫ
            await storeAPI.set('current_room_name', newRoom.name);
            await storeAPI.set('current_room_type', newRoom.type || 'text');
            
            setShowCreateModal(false);
            setNewRoomName("");
            setNewRoomTopic("");
            setNewRoomType("text");
            setNewRoomBitrate(64);
            setNewRoomUserLimit(0);
            
            if (onRoomSelect) {
                onRoomSelect(newRoom.id);
            }
        } catch (err) {
            console.error("Create room error:", err);
            alert(err instanceof Error ? err.message : "Ошибка создания комнаты");
        }
    }, [newRoomName, newRoomTopic, newRoomType, newRoomBitrate, newRoomUserLimit, guildId, onRoomSelect]);

    // Получаем тип комнаты (поддерживаем оба варианта: room_type и type)
    const getRoomType = (room: RoomData): string => {
        return room.room_type || room.type || 'text';
    };

    // Группируем комнаты по типу
    const textRooms = rooms.filter(room => getRoomType(room) === 'text');
    const voiceRooms = rooms.filter(room => getRoomType(room) === 'voice');
    const otherRooms = rooms.filter(room => {
        const type = getRoomType(room);
        return type !== 'text' && type !== 'voice';
    });

    if (loading && rooms.length === 0) {
        return (
            <div className="rooms-list-block">
                <div className="rooms-loading">Загрузка комнат...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rooms-list-block">
                <div className="rooms-error">Ошибка: {error}</div>
                <button onClick={loadRooms}>Повторить</button>
            </div>
        );
    }

    return (
        <div className="rooms-list-block">
            <div className="rooms-header">
                <h3>Комнаты</h3>
                {/* Показываем кнопку создания только если есть право */}
                {hasCreateRooms && (
                    <button onClick={() => setShowCreateModal(true)} className="create-room-btn">
                        Создать
                    </button>
                )}
            </div>
            
            <div className="rooms-list">
                {rooms.length === 0 ? (
                    <div className="no-rooms">Нет комнат</div>
                ) : (
                    <>
                        {/* Текстовые комнаты */}
                        {textRooms.length > 0 && (
                            <div className="room-group">
                                <div className="room-group-label" data-type="text">
                                    Текстовые
                                </div>
                                {textRooms.map((room) => (
                                    <Switch_Room_Button
                                        key={room.id}
                                        roomId={room.id}
                                        name={room.name}
                                        isActive={currentRoomId === room.id}
                                        onSelect={onRoomSelect}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Голосовые комнаты */}
                        {voiceRooms.length > 0 && (
                            <div className="room-group">
                                <div className="room-group-label" data-type="voice">
                                    Голосовые
                                </div>
                                {voiceRooms.map((room) => (
                                    <Switch_Room_Button
                                        key={room.id}
                                        roomId={room.id}
                                        name={`${room.name} ${room.member_count ? `(${room.member_count})` : ''}`}
                                        isActive={currentRoomId === room.id}
                                        onSelect={onRoomSelect}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {/* Другие комнаты */}
                        {/* {otherRooms.length > 0 && (
                            <div className="room-group">
                                <div className="room-group-label">Другие</div>
                                {otherRooms.map((room) => (
                                    <Switch_Room_Button
                                        key={room.id}
                                        roomId={room.id}
                                        name={room.name}
                                        isActive={currentRoomId === room.id}
                                        onSelect={onRoomSelect}
                                    />
                                ))}
                            </div>
                        )} */}
                    </>
                )}
            </div>
            
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Создать комнату</h3>
                        
                        <div className="form-group">
                            <label>Тип комнаты</label>
                            <div className="room-type-selector">
                                <button
                                    className={`type-btn ${newRoomType === 'text' ? 'active' : ''}`}
                                    data-type="text"
                                    onClick={() => setNewRoomType('text')}
                                >
                                    Текст
                                </button>
                                <><button
                                    className={`type-btn ${newRoomType === 'voice' ? 'active' : ''}`}
                                    data-type="voice"
                                    onClick={() => setNewRoomType('voice')}
                                >
                                    Голос
                                </button></>
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label>Название комнаты</label>
                            <input
                                type="text"
                                placeholder="Введите название..."
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Тема (необязательно)</label>
                            <textarea
                                placeholder="Опишите тему комнаты..."
                                value={newRoomTopic}
                                onChange={(e) => setNewRoomTopic(e.target.value)}
                                rows={2}
                            />
                        </div>
                        
                        {newRoomType === 'voice' && (
                            <>
                                <div className="form-group">
                                    <label>Битрейт</label>
                                    <select
                                        value={newRoomBitrate}
                                        onChange={(e) => setNewRoomBitrate(Number(e.target.value))}
                                    >
                                        <option value={32}>32 кбит/с (Эконом)</option>
                                        <option value={64}>64 кбит/с (Стандарт)</option>
                                        <option value={96}>96 кбит/с (Хороший)</option>
                                        <option value={128}>128 кбит/с (Отличный)</option>
                                    </select>
                                </div>
                                
                                {/* Горизонтальные кнопки справа */}
                                <div className="form-group">
                                    <label>Лимит пользователей</label>
                                    <div className="number-input-wrapper-inline">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="0 (Безлимит)"
                                            value={newRoomUserLimit === 0 ? '' : newRoomUserLimit}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                // Если поле пустое, устанавливаем 0
                                                if (value === '') {
                                                    setNewRoomUserLimit(0);
                                                    return;
                                                }
                                                
                                                // Проверяем, что ввод содержит только цифры
                                                if (/^\d+$/.test(value)) {
                                                    const num = Number(value);
                                                    if (num >= 0 && num <= 100) {
                                                        setNewRoomUserLimit(num);
                                                    }
                                                }
                                            }}
                                            onBlur={() => {
                                                // Если поле пустое после потери фокуса, устанавливаем 0
                                                if (newRoomUserLimit === 0) {
                                                    // Оставляем 0
                                                }
                                            }}
                                        />
                                        <div className="number-controls-inline">
                                            <button 
                                                className="number-btn-inline"
                                                onClick={() => setNewRoomUserLimit(prev => Math.max(prev - 1, 0))}
                                                disabled={newRoomUserLimit <= 0}
                                            >
                                                −
                                            </button>
                                            <button 
                                                className="number-btn-inline"
                                                onClick={() => setNewRoomUserLimit(prev => Math.min(prev + 1, 100))}
                                                disabled={newRoomUserLimit >= 100}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ 
                                        fontSize: '11px', 
                                        color: '#5a5a6a', 
                                        marginTop: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <span style={{ marginLeft: 'auto', color: '#3a3a45' }}>
                                            (0-100)
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        <div className="modal-buttons">
                            <button onClick={() => setShowCreateModal(false)}>
                                Отмена
                            </button>
                            <button 
                                onClick={handleCreateRoom}
                                disabled={!newRoomName.trim()}
                            >
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

Rooms_List.displayName = "Rooms_List";