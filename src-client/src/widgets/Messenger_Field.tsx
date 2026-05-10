// widgets/Messenger_Field.tsx
import { Messages_List } from "./Messages_List";
import { Message_Input } from "./Message_Input";
import { wsService } from "../features/websocket.service";
import { useEffect, useState } from "react";
import { useUserPermissions } from "../features/useUserPermissions";
import "./Messenger_Field.css";

interface MessengerFieldProps {
    roomId: number;
    currentUserId?: number;
}

export function Messenger_Field({ roomId, currentUserId }: MessengerFieldProps) {
    const [lastMessage, setLastMessage] = useState<any>(null);
    const [guildId, setGuildId] = useState<number | null>(null);
    const [roomData, setRoomData] = useState<any>(null);

    // Получаем guild_id комнаты
    useEffect(() => {
        const loadRoomData = async () => {
            try {
                const { apiService } = await import("../features/api.service");
                const room = await apiService.getRoomById(roomId);
                if (room && room.guild_id) {
                    setGuildId(room.guild_id);
                    setRoomData(room);
                }
            } catch (error) {
                console.error("Error loading room data:", error);
            }
        };
        loadRoomData();
    }, [roomId]);

    // Получаем права пользователя
    const { hasSendMessages, isLoading: permissionsLoading } = useUserPermissions(guildId);

    useEffect(() => {
        // Подписываемся на новые сообщения
        const unsubscribe = wsService.on('new_message', (message) => {
            console.log('📨 New message received:', message);
            setLastMessage(message);
        });
        
        // Подписываемся на комнату
        wsService.subscribeRoom(roomId);
        
        return () => {
            unsubscribe();
            wsService.unsubscribeRoom(roomId);
        };
    }, [roomId]);

    // Если права еще загружаются
    if (permissionsLoading) {
        return (
            <div className="messenger-field">
                <Messages_List 
                    roomId={roomId} 
                    currentUserId={currentUserId}
                    wsMessage={lastMessage}
                />
                <div className="message-input-placeholder">Загрузка прав доступа...</div>
            </div>
        );
    }

    return (
        <div className="messenger-field">
            <Messages_List 
                roomId={roomId} 
                currentUserId={currentUserId}
                wsMessage={lastMessage}
            />
            {/* Показываем поле ввода только если есть право на отправку сообщений */}
            {hasSendMessages ? (
                <Message_Input roomId={roomId} />
            ) : (
                <></>
            )}
        </div>
    );
}