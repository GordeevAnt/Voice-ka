// widgets/Messenger_Field.tsx
import { Messages_List } from "./Messages_List";
import { Message_Input } from "./Message_Input";
import "./Messenger_Field.css";
import { MutableRefObject } from "react";

interface MessengerFieldProps {
    roomId: number;
    currentUserId?: number;
    wsRef?: MutableRefObject<WebSocket | null>;
    newMessage?: any;
}

export function Messenger_Field({ roomId, currentUserId, wsRef, newMessage }: MessengerFieldProps) {
    return (
        <div className="messenger-field">
            <Messages_List 
                roomId={roomId} 
                currentUserId={currentUserId}
                wsMessage={newMessage}
            />
            <Message_Input 
                roomId={roomId}
                wsRef={wsRef}
            />
        </div>
    );
}