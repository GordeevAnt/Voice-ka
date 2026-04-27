// widgets/Messenger_Field.tsx
import { Messages_List } from "./Messages_List";
import { Message_Input } from "./Message_Input";
import "./Messenger_Field.css";
import { useState, useEffect, useCallback } from "react";

interface MessengerFieldProps {
    roomId: number;
    currentUserId?: number;
}

export function Messenger_Field({ roomId, currentUserId }: MessengerFieldProps) {
    const [refreshKey, setRefreshKey] = useState(0);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    // Обновляем ключ при смене roomId
    useEffect(() => {
        setRefreshKey(prev => prev + 1);
        setIsFirstLoad(true);
    }, [roomId]);

    const handleMessageSent = useCallback(() => {
        // Увеличиваем ключ для немедленного обновления
        setRefreshKey(prev => prev + 1);
        setIsFirstLoad(false);
    }, []);

    return (
        <div className="messenger-field">
            <Messages_List 
                key={`messages-${roomId}-${refreshKey}`}
                roomId={roomId} 
                currentUserId={currentUserId} 
            />
            <Message_Input 
                key={`input-${roomId}`}
                roomId={roomId} 
                onMessageSent={handleMessageSent} 
            />
        </div>
    );
}