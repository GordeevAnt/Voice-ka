import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { storeAPI } from "../features/useStore";
import { wsService } from "../features/websocket.service";

import "./Info.css";

interface RoomData {
    id: number;
    name: string;
    type: string;
}

interface InfoRoomButtonProps {
    roomName?: string;
    roomType?: string;
}

export default function Info_Room_Button({ roomName, roomType }: InfoRoomButtonProps) {
    const [room, setRoom] = useState<RoomData | null>(null);
    const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);

    const loadRoomData = async () => {
        // Если переданы пропсы - используем их
        if (roomName) {
            const roomId = await storeAPI.get<number>('current_room_id');
            if (roomId) {
                setCurrentRoomId(roomId);
                setRoom({
                    id: roomId,
                    name: roomName,
                    type: roomType || 'text'
                });
                console.log('✅ Room data from props:', { roomId, roomName, roomType });
                return;
            }
        }

        // Иначе загружаем из хранилища
        const roomId = await storeAPI.get<number>('current_room_id');
        const name = await storeAPI.get<string>('current_room_name');
        const type = await storeAPI.get<string>('current_room_type');

        if (roomId && name) {
            setCurrentRoomId(roomId);
            setRoom({
                id: roomId,
                name: name,
                type: type || 'text'
            });
            console.log('✅ Room data loaded from store:', { roomId, name, type });
        } else {
            setCurrentRoomId(null);
            setRoom(null);
            console.log('⚠️ No room data in store');
        }
    };

    useEffect(() => {
        loadRoomData();

        // 👇 Подписываемся на обновления комнаты
        const unsubscribeRoomUpdated = wsService.on('room_updated', (updatedRoom) => {
            console.log('🔄 Room updated via WS:', updatedRoom);
            // Проверяем, что это текущая комната
            if (currentRoomId && updatedRoom.id === currentRoomId) {
                setRoom(prev => prev ? {
                    ...prev,
                    name: updatedRoom.name || prev.name,
                    type: updatedRoom.type || prev.type
                } : null);
                
                // Обновляем данные в хранилище
                storeAPI.set('current_room_name', updatedRoom.name);
                storeAPI.set('current_room_type', updatedRoom.type || 'text');
            }
        });

        // 👇 Подписываемся на создание новой комнаты
        const unsubscribeRoomCreated = wsService.on('room_created', (newRoom) => {
            console.log('🆕 Room created via WS:', newRoom);
            // Если текущей комнаты нет, загружаем данные
            if (!currentRoomId) {
                loadRoomData();
            }
        });

        // 👇 Подписываемся на удаление комнаты
        const unsubscribeRoomDeleted = wsService.on('room_deleted', (data) => {
            console.log('🗑️ Room deleted via WS:', data);
            if (currentRoomId && data.room_id === currentRoomId) {
                setCurrentRoomId(null);
                setRoom(null);
                storeAPI.delete('current_room_id');
                storeAPI.delete('current_room_name');
                storeAPI.delete('current_room_type');
            }
        });

        // 👇 Подписываемся на смену гильдии
        const unsubscribeGuildSwitched = wsService.on('guild_switched', () => {
            console.log('🔄 Guild switched, reloading room data');
            loadRoomData();
        });

        return () => {
            unsubscribeRoomUpdated();
            unsubscribeRoomCreated();
            unsubscribeRoomDeleted();
            unsubscribeGuildSwitched();
        };
    }, [currentRoomId, roomName, roomType]); // 👈 Добавляем пропсы в зависимости

    // Иконка в зависимости от типа комнаты
    const getRoomIcon = (type: string) => {
        switch (type) {
            case 'voice':
                return '🎙️';
            case 'text':
            default:
                return '#';
        }
    };

    if (!room) return null;

    return (
        <Link to="/room_info">
            <div className="room-info-btn">
                <span className="room-info-icon">{getRoomIcon(room.type)}</span>
                <span className="room-info-name">{room.name}</span>
            </div>
        </Link>
    );
}