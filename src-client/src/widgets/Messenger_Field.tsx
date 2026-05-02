// widgets/Messenger_Field.tsx
import { Messages_List } from "./Messages_List";
import { Message_Input } from "./Message_Input";
import { wsService } from "../features/websocket.service";
import { useEffect, useState } from "react";
import "./Messenger_Field.css";

interface MessengerFieldProps {
    roomId: number;
    currentUserId?: number;
}

export function Messenger_Field({ roomId, currentUserId }: MessengerFieldProps) {
    const [lastMessage, setLastMessage] = useState<any>(null);

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

    return (
        <div className="messenger-field">
            <Messages_List 
                roomId={roomId} 
                currentUserId={currentUserId}
                wsMessage={lastMessage}
            />
            <Message_Input roomId={roomId} />
        </div>
    );
}