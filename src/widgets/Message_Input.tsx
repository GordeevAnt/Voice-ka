// widgets/Message_Input.tsx
import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { storeAPI } from "../features/useStore";
import "./Message_Input.css";

interface MessageInputProps {
    roomId: number;
    onMessageSent?: () => void;
}

export function Message_Input({ roomId, onMessageSent }: MessageInputProps) {
    const [content, setContent] = useState("");
    const [isSending, setIsSending] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSend = async () => {
        if (!content.trim() || isSending) return;

        setIsSending(true);
        try {
            const sessionId = await storeAPI.get<string>('session_id');
            
            await invoke("send_message", { 
                roomId, 
                content,
                sessionId: sessionId
            });
            
            setContent("");
            onMessageSent?.();
            
            // Фокусируем обратно на input
            inputRef.current?.focus();
        } catch (err) {
            console.error("Failed to send message:", err);
            alert("Ошибка отправки сообщения: " + (err instanceof Error ? err.message : "Неизвестная ошибка"));
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
                >
                    {isSending ? "Отправка..." : "Отправить"}
                </button>
            </div>
        </div>
    );
}