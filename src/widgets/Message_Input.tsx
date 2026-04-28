// widgets/Message_Input.tsx
import { useState, useRef } from "react";
import { storeAPI } from "../features/useStore";
import "./Message_Input.css";

interface MessageInputProps {
    roomId: number;
    wsRef?: React.MutableRefObject<WebSocket | null>;
}

export function Message_Input({ roomId, wsRef }: MessageInputProps) {
    const [content, setContent] = useState("");
    const [isSending, setIsSending] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSend = async () => {
        if (!content.trim() || isSending) return;
        if (!wsRef?.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.error('WebSocket не подключен');
            alert('Нет подключения к серверу. Попробуйте обновить страницу.');
            return;
        }

        setIsSending(true);
        try {
            const sessionId = await storeAPI.get<string>('session_id');
            
            if (!sessionId) {
                alert('Сессия не найдена. Пожалуйста, перезайдите в систему.');
                return;
            }
            
            // Отправляем через WebSocket
            const message = {
                type: 'send_message',
                room_id: roomId,
                data: {
                    room_id: roomId,
                    content: content.trim(),
                    session_id: sessionId
                }
            };
            
            console.log('Отправка сообщения:', message);
            wsRef.current.send(JSON.stringify(message));
            
            setContent("");
            inputRef.current?.focus();
        } catch (err) {
            console.error("Failed to send message:", err);
            alert("Ошибка отправки сообщения");
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="message-input-container">
            <div className="message-input-block">
                <input
                    ref={inputRef}
                    id="message-input"
                    placeholder="Напиши сообщение :)"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isSending}
                />
                <button 
                    className="send-btn" 
                    onClick={handleSend}
                    disabled={isSending || !content.trim()}
                >
                    {isSending ? "Отправка..." : "Отправить"}
                </button>
            </div>
        </div>
    );
}