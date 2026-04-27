// widgets/Messages_List.tsx
import { useEffect, useState, useCallback, memo, useRef } from "react";
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
    const [lastMessageId, setLastMessageId] = useState<number>(0);
    const pollInterval = useRef<ReturnType<typeof setInterval>>();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Функция загрузки сообщений
    const loadMessages = useCallback(async () => {
        if (!roomId) return;
        
        try {
            const fetchedMessages = await invoke<MessageType[]>("get_room_messages", { roomId });
            setMessages(fetchedMessages);
            
            // Обновляем ID последнего сообщения
            if (fetchedMessages.length > 0) {
                const maxId = Math.max(...fetchedMessages.map(m => m.id));
                setLastMessageId(maxId);
            }
            
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка загрузки сообщений");
            console.error("Failed to load messages:", err);
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    // Функция проверки новых сообщений (polling)
    const checkNewMessages = useCallback(async () => {
        if (!roomId) return;
        
        try {
            // Получаем все сообщения комнаты
            const fetchedMessages = await invoke<MessageType[]>("get_room_messages", { roomId });
            
            if (fetchedMessages.length > 0) {
                const maxId = Math.max(...fetchedMessages.map(m => m.id));
                
                // Если есть новые сообщения, обновляем список
                if (maxId > lastMessageId) {
                    setMessages(fetchedMessages);
                    setLastMessageId(maxId);
                    // Прокручиваем вниз
                    scrollToBottom();
                }
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    }, [roomId, lastMessageId]);

    // Загружаем сообщения при монтировании и смене комнаты
    useEffect(() => {
        setLoading(true);
        setMessages([]);
        setLastMessageId(0);
        loadMessages();
    }, [loadMessages]);

    // Запускаем polling при изменении roomId
    useEffect(() => {
        // Очищаем предыдущий интервал
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
        }
        
        // Запускаем новый polling каждые 2 секунды
        pollInterval.current = setInterval(checkNewMessages, 2000);
        
        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, [checkNewMessages, roomId]);

    // Прокрутка вниз при новых сообщениях
    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Прокручиваем вниз при первой загрузке
    useEffect(() => {
        if (!loading && messages.length > 0) {
            scrollToBottom();
        }
    }, [loading, messages.length]);

    // Обработка новых сообщений (для внешнего использования)
    const handleNewMessage = useCallback((newMessage: MessageType) => {
        setMessages(prev => {
            if (prev.some(msg => msg.id === newMessage.id)) return prev;
            const updated = [...prev, newMessage];
            setLastMessageId(newMessage.id);
            return updated;
        });
        scrollToBottom();
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
                            onDelete={handleDeleteMessage}
                            onEdit={handleEditMessage}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
});

Messages_List.displayName = "MessagesList";