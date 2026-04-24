import { Messages_List } from "./Messages_List";
import { Message_Input } from "./Message_Input";
import "./Messenger_Field.css";
import { useState } from "react";

interface MessengerFieldProps {
    roomId: number;
    currentUserId?: number;
}

export function Messenger_Field({ roomId, currentUserId }: MessengerFieldProps) {
    const [refreshKey, setRefreshKey] = useState(0);

    const handleMessageSent = () => {
        // Обновляем ключ для перезагрузки сообщений
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div className="messenger-field">
        <Messages_List 
            key={refreshKey}
            roomId={roomId} 
            currentUserId={currentUserId} 
        />
        <Message_Input 
            roomId={roomId} 
            onMessageSent={handleMessageSent} 
        />
        </div>
    );
}