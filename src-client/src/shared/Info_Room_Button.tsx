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
    isActive?: boolean;
}

export default function Info_Room_Button({ roomName, roomType, isActive = false }: InfoRoomButtonProps) {
    const [room, setRoom] = useState<RoomData | null>(null);
    const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);

    const loadRoomData = async () => {
        if (roomName) {
            const roomId = await storeAPI.get<number>('current_room_id');
            if (roomId) {
                setCurrentRoomId(roomId);
                setRoom({
                    id: roomId,
                    name: roomName,
                    type: roomType || 'text'
                });
                return;
            }
        }

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
        } else {
            setCurrentRoomId(null);
            setRoom(null);
        }
    };

    useEffect(() => {
        loadRoomData();

        const unsubscribeRoomUpdated = wsService.on('room_updated', (updatedRoom) => {
            if (currentRoomId && updatedRoom.id === currentRoomId) {
                setRoom(prev => prev ? {
                    ...prev,
                    name: updatedRoom.name || prev.name,
                    type: updatedRoom.type || prev.type
                } : null);
                
                storeAPI.set('current_room_name', updatedRoom.name);
                storeAPI.set('current_room_type', updatedRoom.type || 'text');
            }
        });

        const unsubscribeGuildSwitched = wsService.on('guild_switched', () => {
            setTimeout(loadRoomData, 100);
        });

        return () => {
            unsubscribeRoomUpdated();
            unsubscribeGuildSwitched();
        };
    }, [currentRoomId, roomName, roomType]);

    const getRoomIcon = (type: string) => {
        switch (type) {
            case 'voice':
                return '🔊';
            case 'text':
            default:
                return '#';
        }
    };

    // УБИРАЕМ ПЕРВОЕ УСЛОВИЕ if (!room) и ОБЪЕДИНЯЕМ ВСЕ В ОДНО
    // Если нет комнаты ИЛИ не активна - показываем неактивное состояние
    if (!room || !isActive) {
        return (
            <div className="room-info-btn">
                <Link 
                    to="/room_info" 
                    data-tooltip="Нет комнаты"
                    className="room-info-btn-inactive"
                    onClick={(e) => e.preventDefault()}
                >
                    <span className="room-info-icon" style={{ opacity: 0.3 }}>#</span>
                    <span className="room-info-text" style={{ opacity: 0.3 }}>Нет комнаты</span>
                </Link>
            </div>
        );
    }

    // Активное состояние
    return (
        <div className="room-info-btn">
            <Link to="/room_info" data-tooltip={room.name}>
                <span className="room-info-icon">{getRoomIcon(room.type)}</span>
                <span className="room-info-text">{room.name}</span>
            </Link>
        </div>
    );
}