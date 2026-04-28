// widgets/Messages_List.tsx
import { useEffect, useState, useCallback, memo, useRef } from "react";
import "./Messages_List.css";
import { invoke } from "@tauri-apps/api/core";
import { Message } from "../entities/Message";

interface MessageType {
    id: number;
    room_id: number;
    user_id: number;
    content: string;
    attachments: any;
    reply_to_id: number | null;
    edited_at: string | null;
    deleted_at: string | null;
    created_at: string;
    author_name: string;
}

interface MessagesListProps {
    roomId: number;
    currentUserId?: number;
    onNewMessage?: (message: MessageType) => void;
    wsMessage?: any | null; // Изменяем тип на any
}

export const Messages_List = memo(({ roomId, currentUserId, wsMessage }: MessagesListProps) => {
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadMessages = useCallback(async () => {
        if (!roomId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const fetchedMessages = await invoke<MessageType[]>("get_room_messages", { roomId });
            setMessages(fetchedMessages);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка загрузки сообщений");
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        setMessages([]);
        loadMessages();
    }, [loadMessages]);

    // Добавляем новое сообщение из WebSocket
    useEffect(() => {
        if (!wsMessage) return;
        
        // Проверяем структуру сообщения
        const messageData = wsMessage.data || wsMessage;
        
        // Проверяем, что сообщение для этой комнаты
        const messageRoomId = messageData.room_id || wsMessage.room_id;
        if (messageRoomId !== roomId) return;
        
        setMessages(prev => {
            // Проверяем, нет ли уже такого сообщения по ID
            const messageId = messageData.id;
            if (messageId) {
                const exists = prev.some(msg => msg.id === messageId);
                if (exists) return prev;
            }
            
            // Добавляем новое сообщение
            const newMessage: MessageType = {
                id: messageData.id || Date.now(),
                room_id: messageData.room_id || roomId,
                user_id: messageData.user_id || 0,
                content: messageData.content || '',
                attachments: messageData.attachments || [],
                reply_to_id: messageData.reply_to_id || null,
                edited_at: messageData.edited_at || null,
                deleted_at: messageData.deleted_at || null,
                created_at: messageData.created_at || new Date().toISOString(),
                author_name: messageData.author_name || "Unknown",
            };
            
            return [...prev, newMessage];
        });
    }, [wsMessage, roomId]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    useEffect(() => {
        if (!loading && messages.length > 0) {
            scrollToBottom();
        }
    }, [loading, messages.length]);

    // Scroll when new message arrives
    useEffect(() => {
        if (wsMessage) {
            scrollToBottom();
        }
    }, [wsMessage]);

    if (loading) {
        return (
            <div className="messages-list-block">
                <div className="messages-loading">Загрузка сообщений...</div>
            </div>
        );
    }

    if (error && messages.length === 0) {
        return (
            <div className="messages-list-block">
                <div className="messages-error">
                    <p>Ошибка: {error}</p>
                    <button onClick={loadMessages}>Повторить</button>
                </div>
            </div>
        );
    }

    return (
        <div className="messages-list-block">
            <div className="messages-list">
                {messages.length === 0 ? (
                    <div className="messages-empty">Нет сообщений. Напишите первое сообщение!</div>
                ) : (
                    messages.map((msg) => (
                        <Message
                            key={msg.id}
                            id={msg.id}
                            author={msg.author_name}
                            text={msg.content}
                            timestamp={new Date(msg.created_at).toLocaleString()}
                            isCurrentUser={currentUserId === msg.user_id}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
});

Messages_List.displayName = "MessagesList";