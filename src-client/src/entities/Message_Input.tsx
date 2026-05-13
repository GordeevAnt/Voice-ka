// widgets/Message_Input.tsx
import { useState, useRef } from "react";
import { apiService } from "../features/api.service";
import "./Message_Input.css";

interface MessageInputProps {
    roomId: number;
}

export function Message_Input({ roomId }: MessageInputProps) {
    const [content, setContent] = useState("");
    const [isSending, setIsSending] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSend = async () => {
        if (!content.trim() || isSending) return;

        setIsSending(true);
        try {
            await apiService.sendMessage(roomId, content.trim());
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