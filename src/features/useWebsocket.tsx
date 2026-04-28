// features/useWebsocket.tsx
import { useEffect, useRef, useState, useCallback } from 'react';

type MessageHandler = (data: any) => void;

interface WsMessage {
    type: string;
    room_id?: number;
    guild_id?: number;
    data?: any;
    timestamp?: string;
}

// Глобальное состояние WebSocket (синглтон)
let globalWs: WebSocket | null = null;
let globalIsConnected = false;
const globalSubscribedRooms = new Set<number>();
const globalSubscribedGuilds = new Set<number>();
const globalMessageHandlers = new Map<string, Set<MessageHandler>>();
const globalConnectionListeners = new Set<(connected: boolean) => void>();
const globalMessageListeners = new Set<(message: any) => void>();

let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const WS_PORT = 9001;

// Функция для уведомления всех слушателей о изменении состояния подключения
function notifyConnectionListeners() {
    globalConnectionListeners.forEach(listener => listener(globalIsConnected));
}

// Функция для уведомления всех слушателей о новом сообщении
function notifyMessageListeners(message: any) {
    globalMessageListeners.forEach(listener => listener(message));
}

// Создание и управление единственным WebSocket соединением
function getOrCreateWebSocket(): WebSocket | null {
    // Если уже есть открытое соединение, возвращаем его
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
        return globalWs;
    }

    // Если соединение в процессе установки, ждем
    if (globalWs && globalWs.readyState === WebSocket.CONNECTING) {
        return globalWs;
    }

    // Создаем новое соединение
    try {
        const ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);
        
        ws.onopen = () => {
            console.log('🟢 WebSocket connected');
            globalIsConnected = true;
            reconnectAttempt = 0;
            notifyConnectionListeners();
            
            // Переподписываемся на все комнаты и гильдии
            globalSubscribedRooms.forEach(roomId => {
                ws.send(JSON.stringify({
                    type: 'subscribe_room',
                    room_id: roomId
                }));
            });
            
            globalSubscribedGuilds.forEach(guildId => {
                ws.send(JSON.stringify({
                    type: 'subscribe_guild',
                    guild_id: guildId
                }));
            });
        };
        
        ws.onmessage = (event) => {
            try {
                const message: WsMessage = JSON.parse(event.data);
                
                // Уведомляем общих слушателей
                notifyMessageListeners(message);
                
                // Вызываем специфичные обработчики
                const handlers = globalMessageHandlers.get(message.type);
                if (handlers) {
                    handlers.forEach(handler => handler(message.data));
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        };
        
        ws.onclose = (event) => {
            console.log('🔴 WebSocket disconnected');
            globalIsConnected = false;
            notifyConnectionListeners();
            
            // Переподключение только при непреднамеренном закрытии
            if (event.code !== 1000 && reconnectAttempt < MAX_RECONNECT_ATTEMPTS && globalSubscribedRooms.size > 0) {
                reconnectAttempt++;
                const delay = 2000 * reconnectAttempt;
                console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`);
                
                reconnectTimeout = setTimeout(() => {
                    globalWs = null;
                    getOrCreateWebSocket();
                }, delay);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        globalWs = ws;
        return ws;
    } catch (err) {
        console.error('Failed to create WebSocket:', err);
        return null;
    }
}

// Пинг для поддержания соединения
setInterval(() => {
    if (globalWs?.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({ type: 'ping' }));
    }
}, 30000);

// Основной хук для использования в компонентах
export function useWebSocket(options: {
    currentGuildId?: number;
    currentRoomId?: number;
    onNewMessage?: (message: any) => void;
    onUserOnline?: (user: any) => void;
    onUserOffline?: (userId: number) => void;
    onUserStatusChanged?: (user: any) => void;
    onRoomCreated?: (room: any) => void;
    onRoomUpdated?: (room: any) => void;
    onRoomDeleted?: (roomId: number) => void;
} = {}) {
    const {
        currentGuildId,
        currentRoomId,
        onNewMessage,
        onUserOnline,
        onUserOffline,
        onUserStatusChanged,
        onRoomCreated,
        onRoomUpdated,
        onRoomDeleted,
    } = options;

    const [isConnected, setIsConnected] = useState(globalIsConnected);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const wsRef = useRef<WebSocket | null>(globalWs);
    const mountedRef = useRef(true);

    // Подписка на изменения состояния подключения
    useEffect(() => {
        mountedRef.current = true;
        
        const connectionListener = (connected: boolean) => {
            if (mountedRef.current) {
                setIsConnected(connected);
                wsRef.current = globalWs;
            }
        };
        
        globalConnectionListeners.add(connectionListener);
        
        // Создаем соединение при первом использовании
        const ws = getOrCreateWebSocket();
        wsRef.current = ws;
        setIsConnected(globalIsConnected);
        
        return () => {
            mountedRef.current = false;
            globalConnectionListeners.delete(connectionListener);
        };
    }, []);

    // Подписка на все сообщения
    useEffect(() => {
        const messageListener = (message: any) => {
            if (mountedRef.current) {
                setLastMessage(message);
            }
        };
        
        globalMessageListeners.add(messageListener);
        
        return () => {
            globalMessageListeners.delete(messageListener);
        };
    }, []);

    // Управление подписками на комнаты
    useEffect(() => {
        if (!currentRoomId) return;

        const ws = globalWs;
        if (ws?.readyState === WebSocket.OPEN && !globalSubscribedRooms.has(currentRoomId)) {
            globalSubscribedRooms.add(currentRoomId);
            ws.send(JSON.stringify({
                type: 'subscribe_room',
                room_id: currentRoomId
            }));
        }

        return () => {
            if (currentRoomId && globalSubscribedRooms.has(currentRoomId)) {
                globalSubscribedRooms.delete(currentRoomId);
                if (ws?.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'unsubscribe_room',
                        room_id: currentRoomId
                    }));
                }
                
                // Если нет активных подписок, закрываем соединение
                if (globalSubscribedRooms.size === 0 && globalSubscribedGuilds.size === 0) {
                    if (globalWs?.readyState === WebSocket.OPEN) {
                        globalWs.close(1000, 'No subscriptions');
                        globalWs = null;
                    }
                }
            }
        };
    }, [currentRoomId]);

    // Управление подписками на гильдии
    useEffect(() => {
        if (!currentGuildId) return;

        const ws = globalWs;
        if (ws?.readyState === WebSocket.OPEN && !globalSubscribedGuilds.has(currentGuildId)) {
            globalSubscribedGuilds.add(currentGuildId);
            ws.send(JSON.stringify({
                type: 'subscribe_guild',
                guild_id: currentGuildId
            }));
        }

        return () => {
            if (currentGuildId && globalSubscribedGuilds.has(currentGuildId)) {
                globalSubscribedGuilds.delete(currentGuildId);
                if (ws?.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'unsubscribe_guild',
                        guild_id: currentGuildId
                    }));
                }
                
                // Если нет активных подписок, закрываем соединение
                if (globalSubscribedRooms.size === 0 && globalSubscribedGuilds.size === 0) {
                    if (globalWs?.readyState === WebSocket.OPEN) {
                        globalWs.close(1000, 'No subscriptions');
                        globalWs = null;
                    }
                }
            }
        };
    }, [currentGuildId]);

    // Регистрация обработчиков сообщений
    useEffect(() => {
        if (onNewMessage) {
            if (!globalMessageHandlers.has('new_message')) {
                globalMessageHandlers.set('new_message', new Set());
            }
            globalMessageHandlers.get('new_message')!.add(onNewMessage);
        }
        if (onUserOnline) {
            if (!globalMessageHandlers.has('user_online')) {
                globalMessageHandlers.set('user_online', new Set());
            }
            globalMessageHandlers.get('user_online')!.add(onUserOnline);
        }
        if (onUserOffline) {
            if (!globalMessageHandlers.has('user_offline')) {
                globalMessageHandlers.set('user_offline', new Set());
            }
            globalMessageHandlers.get('user_offline')!.add(onUserOffline);
        }
        if (onUserStatusChanged) {
            if (!globalMessageHandlers.has('user_status_changed')) {
                globalMessageHandlers.set('user_status_changed', new Set());
            }
            globalMessageHandlers.get('user_status_changed')!.add(onUserStatusChanged);
        }
        if (onRoomCreated) {
            if (!globalMessageHandlers.has('room_created')) {
                globalMessageHandlers.set('room_created', new Set());
            }
            globalMessageHandlers.get('room_created')!.add(onRoomCreated);
        }
        if (onRoomUpdated) {
            if (!globalMessageHandlers.has('room_updated')) {
                globalMessageHandlers.set('room_updated', new Set());
            }
            globalMessageHandlers.get('room_updated')!.add(onRoomUpdated);
        }
        if (onRoomDeleted) {
            if (!globalMessageHandlers.has('room_deleted')) {
                globalMessageHandlers.set('room_deleted', new Set());
            }
            globalMessageHandlers.get('room_deleted')!.add(onRoomDeleted);
        }

        return () => {
            if (onNewMessage) globalMessageHandlers.get('new_message')?.delete(onNewMessage);
            if (onUserOnline) globalMessageHandlers.get('user_online')?.delete(onUserOnline);
            if (onUserOffline) globalMessageHandlers.get('user_offline')?.delete(onUserOffline);
            if (onUserStatusChanged) globalMessageHandlers.get('user_status_changed')?.delete(onUserStatusChanged);
            if (onRoomCreated) globalMessageHandlers.get('room_created')?.delete(onRoomCreated);
            if (onRoomUpdated) globalMessageHandlers.get('room_updated')?.delete(onRoomUpdated);
            if (onRoomDeleted) globalMessageHandlers.get('room_deleted')?.delete(onRoomDeleted);
        };
    }, [onNewMessage, onUserOnline, onUserOffline, onUserStatusChanged, onRoomCreated, onRoomUpdated, onRoomDeleted]);

    // Функции для ручного управления подписками
    const subscribeToRoom = useCallback((roomId: number) => {
        const ws = getOrCreateWebSocket();
        if (ws?.readyState === WebSocket.OPEN && !globalSubscribedRooms.has(roomId)) {
            globalSubscribedRooms.add(roomId);
            ws.send(JSON.stringify({
                type: 'subscribe_room',
                room_id: roomId
            }));
        }
    }, []);

    const unsubscribeFromRoom = useCallback((roomId: number) => {
        globalSubscribedRooms.delete(roomId);
        if (globalWs?.readyState === WebSocket.OPEN) {
            globalWs.send(JSON.stringify({
                type: 'unsubscribe_room',
                room_id: roomId
            }));
        }
    }, []);

    const subscribeToGuild = useCallback((guildId: number) => {
        const ws = getOrCreateWebSocket();
        if (ws?.readyState === WebSocket.OPEN && !globalSubscribedGuilds.has(guildId)) {
            globalSubscribedGuilds.add(guildId);
            ws.send(JSON.stringify({
                type: 'subscribe_guild',
                guild_id: guildId
            }));
        }
    }, []);

    const unsubscribeFromGuild = useCallback((guildId: number) => {
        globalSubscribedGuilds.delete(guildId);
        if (globalWs?.readyState === WebSocket.OPEN) {
            globalWs.send(JSON.stringify({
                type: 'unsubscribe_guild',
                guild_id: guildId
            }));
        }
    }, []);

    return {
        isConnected,
        wsRef,
        lastMessage,
        subscribeToRoom,
        unsubscribeFromRoom,
        subscribeToGuild,
        unsubscribeFromGuild,
    };
}