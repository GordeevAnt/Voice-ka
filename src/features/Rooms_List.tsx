// Rooms_List.tsx - исправленная версия
import { useEffect, useState, useCallback, memo } from "react";
import "./Rooms_List.css";
import { invoke } from "@tauri-apps/api/core";
import { Switch_Room_Button } from "../shared/Switch_Room_Button";
import { storeAPI } from "../features/useStore";
import { useWebSocket } from "./useWebsocket";

interface RoomData {
    id: number;
    name: string;
    room_type: string;
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
    const [newRoomType, setNewRoomType] = useState("text");
    const [newRoomTopic, setNewRoomTopic] = useState("");

    const { lastMessage } = useWebSocket({
        currentGuildId: guildId,
    });

    useEffect(() => {
        if (lastMessage?.type === 'room_created' && lastMessage?.guild_id === guildId) {
            const newRoom = lastMessage.data;
            setRooms(prev => {
                const exists = prev.some(r => r.id === newRoom.id);
                if (exists) return prev;
                return [...prev, newRoom];
            });
        }
    }, [lastMessage, guildId]);

    const loadRooms = useCallback(async () => {
        if (!guildId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const guildRooms = await invoke<RoomData[]>("get_guild_rooms", { guildId });
            setRooms(guildRooms);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка загрузки комнат");
            console.error("Failed to load rooms:", err);
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        loadRooms();
    }, [loadRooms]);

    useWebSocket({
        currentGuildId: guildId,
        onRoomCreated: (room: RoomData) => {
            setRooms(prev => {
                // Проверяем, нет ли уже такой комнаты
                const exists = prev.some(r => r.id === room.id);
                if (exists) return prev;
                return [...prev, room];
            });
        }
    });

    const handleCreateRoom = useCallback(async () => {
        if (!newRoomName.trim()) {
            alert("Введите название комнаты");
            return;
        }
        
        const userId = await storeAPI.get<string>('user_id');
        if (!userId) {
            alert("Пользователь не авторизован");
            return;
        }
        
        try {
            const newRoom = await invoke<RoomData>("create_room", {
                roomData: {
                    name: newRoomName.trim(),
                    room_type: newRoomType,
                    guild_id: guildId,
                    topic: newRoomTopic.trim() || null,
                    bitrate: newRoomType === 'voice' ? 64000 : null,
                    user_limit: newRoomType === 'voice' ? 0 : null,
                    creator_id: parseInt(userId) 
                }
            });
            
            setRooms(prev => [...prev, newRoom]);
            setShowCreateModal(false);
            setNewRoomName("");
            setNewRoomTopic("");
            
            if (onRoomSelect) {
                onRoomSelect(newRoom.id);
            }
        } catch (err) {
            console.error("Create room error:", err);
            alert(err instanceof Error ? err.message : "Ошибка создания комнаты");
        }
    }, [newRoomName, newRoomType, newRoomTopic, guildId, onRoomSelect]);

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

    const textRooms = rooms.filter(r => r.room_type === 'text');
    const voiceRooms = rooms.filter(r => r.room_type === 'voice');

    return (
        <div className="rooms-list-block">
            <div className="rooms-header">
                <h3>Текстовые комнаты</h3>
                <button onClick={() => setShowCreateModal(true)} className="create-room-btn">
                    Создать
                </button>
            </div>
            
            <div className="rooms-list">
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
            
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Создать комнату</h3>
                        <input
                            type="text"
                            placeholder="Название комнаты"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            autoFocus
                        />
                        <select value={newRoomType} onChange={(e) => setNewRoomType(e.target.value)}>
                            <option value="text">Текстовая</option>
                        </select>
                        <textarea
                            placeholder="Тема (необязательно)"
                            value={newRoomTopic}
                            onChange={(e) => setNewRoomTopic(e.target.value)}
                        />
                        <div className="modal-buttons">
                            <button onClick={() => setShowCreateModal(false)}>Отмена</button>
                            <button onClick={handleCreateRoom}>Создать</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

Rooms_List.displayName = "Rooms_List";