import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { storeAPI } from "../features/useStore";
import "./Message_Input.css";

interface MessageInputProps {
  roomId: number;
  onMessageSent?: () => void;
}

export function Message_Input({ roomId, onMessageSent }: MessageInputProps) {
    const [content, setContent] = useState("");

    const handleSend = async () => {
        if (!content.trim()) return;

        try {
            // Получаем session_id из хранилища
            const sessionId = await storeAPI.get<string>('session_id');
            
            await invoke("send_message", { 
                roomId, 
                content,
                sessionId: sessionId // Передаем session_id
            });
            setContent("");
            onMessageSent?.();
        } catch (err) {
            console.error("Failed to send message:", err);
            alert("Ошибка отправки сообщения: " + (err instanceof Error ? err.message : "Неизвестная ошибка"));
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
                    id="message-input"
                    placeholder="Напиши сообщение :)"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyPress={handleKeyPress}
                />
                <button className="send-btn" onClick={handleSend}>
                    Отправить
                </button>
            </div>
        </div>
    );
}