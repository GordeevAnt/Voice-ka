import { useEffect, useState, useCallback, memo } from "react";
import "./Messages_List.css";
import { invoke } from "@tauri-apps/api/core";
import { Message } from "../entities/Message";

// Типы для сообщений
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

// Пропсы компонента
interface MessagesListProps {
    roomId: number;
    currentUserId?: number;
}

// Компонент списка сообщений
export const Messages_List = memo(({ roomId, currentUserId }: MessagesListProps) => {
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Функция загрузки сообщений
    const loadMessages = useCallback(async () => {
        if (!roomId) return;
        
        setLoading(true);
        setError(null);
        
        try {
        const fetchedMessages = await invoke<MessageType[]>("get_room_messages", { roomId });
        setMessages(fetchedMessages);
        } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки сообщений");
        console.error("Failed to load messages:", err);
        } finally {
        setLoading(false);
        }
    }, [roomId]);

    // Загружаем сообщения при монтировании и смене комнаты
    useEffect(() => {
        loadMessages();
    }, [loadMessages]);

    // Обработка новых сообщений (WebSocket или polling)
    const handleNewMessage = useCallback((newMessage: MessageType) => {
        setMessages(prev => {
        // Проверяем, нет ли уже такого сообщения
        if (prev.some(msg => msg.id === newMessage.id)) return prev;
        return [...prev, newMessage];
        });
    }, []);

    // Обработка удаления сообщения
    const handleDeleteMessage = useCallback((messageId: number) => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }, []);

    // Обработка редактирования сообщения
    const handleEditMessage = useCallback((editedMessage: MessageType) => {
        setMessages(prev => prev.map(msg => 
        msg.id === editedMessage.id ? editedMessage : msg
        ));
    }, []);

    if (loading && messages.length === 0) {
        return (
        <div className="messages-list-block">
            <div className="messages-loading">Загрузка сообщений...</div>
        </div>
        );
    }

    if (error) {
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
            <div className="messages-empty">Нет сообщений</div>
            ) : (
            messages.map((msg) => (
                <Message
                key={msg.id}
                id={msg.id}
                author={msg.author_name}
                text={msg.content}
                timestamp={new Date(msg.created_at).toLocaleString()}
                isCurrentUser={currentUserId === msg.user_id}
                onDelete={handleDeleteMessage}
                onEdit={handleEditMessage}
                />
            ))
            )}
        </div>
        </div>
    );
});

// Добавляем display name для dev tools
Messages_List.displayName = "MessagesList";

// Хук для использования в родительском компоненте
export const useMessages = (roomId: number) => {
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMessages = useCallback(async () => {
        if (!roomId) return;
        
        setLoading(true);
        try {
        const fetched = await invoke<MessageType[]>("get_room_messages", { roomId });
        setMessages(fetched);
        setError(null);
        } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
        setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    const addMessage = useCallback((message: MessageType) => {
        setMessages(prev => [...prev, message]);
    }, []);

    const updateMessage = useCallback((messageId: number, updates: Partial<MessageType>) => {
        setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
        ));
    }, []);

    const removeMessage = useCallback((messageId: number) => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }, []);

    return { messages, loading, error, addMessage, updateMessage, removeMessage, refetch: fetchMessages };
};