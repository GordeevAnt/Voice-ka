// features/useWebsocket.tsx - исправленная версия
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
const MAX_RECONNECT_ATTEMPTS = 5;
const WS_PORT = 9001;

// Флаг для предотвращения множественных переподключений
let isReconnecting = false;

function notifyConnectionListeners() {
    globalConnectionListeners.forEach(listener => listener(globalIsConnected));
}

function notifyMessageListeners(message: any) {
    globalMessageListeners.forEach(listener => listener(message));
}

function getOrCreateWebSocket(): WebSocket | null {
    // Если уже есть открытое соединение, возвращаем его
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
        return globalWs;
    }

    // Если соединение в процессе установки, ждем
    if (globalWs && globalWs.readyState === WebSocket.CONNECTING) {
        return globalWs;
    }

    // Предотвращаем множественные попытки переподключения
    if (isReconnecting) {
        console.log('⏳ Reconnection already in progress...');
        return null;
    }

    try {
        console.log('🔌 Creating new WebSocket connection...');
        const ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);
        
        ws.onopen = () => {
            console.log('🟢 WebSocket connected');
            globalIsConnected = true;
            reconnectAttempt = 0;
            isReconnecting = false;
            notifyConnectionListeners();
            
            // Небольшая задержка перед подписками
            setTimeout(() => {
                // Подписываемся на все сохраненные комнаты и гильдии
                const rooms = Array.from(globalSubscribedRooms);
                const guilds = Array.from(globalSubscribedGuilds);
                
                console.log('📋 Resubscribing to rooms:', rooms);
                console.log('📋 Resubscribing to guilds:', guilds);
                
                rooms.forEach(roomId => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'subscribe_room',
                            room_id: roomId
                        }));
                    }
                });
                
                guilds.forEach(guildId => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'subscribe_guild',
                            guild_id: guildId
                        }));
                    }
                });
            }, 100);
        };
        
        ws.onmessage = (event) => {
            // Игнорируем пустые сообщения
            if (!event.data || event.data.trim() === '') {
                console.warn('⚠️ Received empty message, ignoring');
                return;
            }
            
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
                console.error('Failed to parse WebSocket message:', err, 'Raw data:', event.data);
            }
        };
        
        ws.onclose = (event) => {
            console.log(`🔴 WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`);
            globalIsConnected = false;
            notifyConnectionListeners();
            
            // Не переподключаемся, если это было намеренное закрытие
            if (event.code === 1000) {
                console.log('👋 Connection closed intentionally');
                return;
            }
            
            // Переподключение с экспоненциальной задержкой
            if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS && !isReconnecting) {
                isReconnecting = true;
                reconnectAttempt++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), 10000);
                console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`);
                
                if (reconnectTimeout) {
                    clearTimeout(reconnectTimeout);
                }
                
                reconnectTimeout = setTimeout(() => {
                    console.log('🔄 Attempting reconnection...');
                    globalWs = null;
                    getOrCreateWebSocket();
                }, delay);
            } else if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
                console.error('❌ Max reconnection attempts reached');
                isReconnecting = false;
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        globalWs = ws;
        return ws;
    } catch (err) {
        console.error('Failed to create WebSocket:', err);
        isReconnecting = false;
        return null;
    }
}

// Пинг для поддержания соединения
const pingInterval = setInterval(() => {
    if (globalWs?.readyState === WebSocket.OPEN) {
        try {
            globalWs.send(JSON.stringify({ type: 'ping' }));
        } catch (err) {
            console.error('Ping failed:', err);
        }
    }
}, 30000);

// Основной хук
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

    useEffect(() => {
        mountedRef.current = true;
        
        const connectionListener = (connected: boolean) => {
            if (mountedRef.current) {
                setIsConnected(connected);
                wsRef.current = globalWs;
            }
        };
        
        globalConnectionListeners.add(connectionListener);
        
        const ws = getOrCreateWebSocket();
        wsRef.current = ws;
        setIsConnected(globalIsConnected);
        
        return () => {
            mountedRef.current = false;
            globalConnectionListeners.delete(connectionListener);
        };
    }, []);

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

    // Управление подписками на комнаты - ИСПРАВЛЕНО
    useEffect(() => {
        if (!currentRoomId) return;

        console.log(`📌 Managing room subscription: ${currentRoomId}`);
        
        // Подписываемся с небольшой задержкой для стабилизации соединения
        const subscribeTimeout = setTimeout(() => {
            const ws = globalWs;
            if (ws?.readyState === WebSocket.OPEN && !globalSubscribedRooms.has(currentRoomId)) {
                globalSubscribedRooms.add(currentRoomId);
                console.log(`📌 Subscribing to room: ${currentRoomId}`);
                ws.send(JSON.stringify({
                    type: 'subscribe_room',
                    room_id: currentRoomId
                }));
            }
        }, 200);

        return () => {
            clearTimeout(subscribeTimeout);
            // НЕ отписываемся при размонтировании - только при смене roomId
        };
    }, [currentRoomId]);

    // Управление подписками на гильдии - ИСПРАВЛЕНО
    useEffect(() => {
        if (!currentGuildId) return;

        console.log(`📌 Managing guild subscription: ${currentGuildId}`);
        
        // Подписываемся с небольшой задержкой для стабилизации соединения
        const subscribeTimeout = setTimeout(() => {
            const ws = globalWs;
            if (ws?.readyState === WebSocket.OPEN && !globalSubscribedGuilds.has(currentGuildId)) {
                globalSubscribedGuilds.add(currentGuildId);
                console.log(`📌 Subscribing to guild: ${currentGuildId}`);
                ws.send(JSON.stringify({
                    type: 'subscribe_guild',
                    guild_id: currentGuildId
                }));
            }
        }, 200);

        return () => {
            clearTimeout(subscribeTimeout);
            // НЕ отписываемся при размонтировании - только при смене guildId
        };
    }, [currentGuildId]);

    // Регистрация обработчиков сообщений
    useEffect(() => {
        const registerHandler = (type: string, handler: MessageHandler | undefined) => {
            if (!handler) return;
            if (!globalMessageHandlers.has(type)) {
                globalMessageHandlers.set(type, new Set());
            }
            globalMessageHandlers.get(type)!.add(handler);
        };

        registerHandler('new_message', onNewMessage);
        registerHandler('user_online', onUserOnline);
        registerHandler('user_offline', onUserOffline);
        registerHandler('user_status_changed', onUserStatusChanged);
        registerHandler('room_created', onRoomCreated);
        registerHandler('room_updated', onRoomUpdated);
        registerHandler('room_deleted', onRoomDeleted);

        return () => {
            const unregisterHandler = (type: string, handler: MessageHandler | undefined) => {
                if (!handler) return;
                globalMessageHandlers.get(type)?.delete(handler);
            };

            unregisterHandler('new_message', onNewMessage);
            unregisterHandler('user_online', onUserOnline);
            unregisterHandler('user_offline', onUserOffline);
            unregisterHandler('user_status_changed', onUserStatusChanged);
            unregisterHandler('room_created', onRoomCreated);
            unregisterHandler('room_updated', onRoomUpdated);
            unregisterHandler('room_deleted', onRoomDeleted);
        };
    }, [onNewMessage, onUserOnline, onUserOffline, onUserStatusChanged, onRoomCreated, onRoomUpdated, onRoomDeleted]);

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