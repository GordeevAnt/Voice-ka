// features/useWebsocket.tsx - теперь просто обертка над wsService
import { useEffect, useState } from 'react';
import { wsService } from './websocket.service';

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
    const [isConnected, setIsConnected] = useState(wsService.getConnectionStatus());

    useEffect(() => {
        const unsubscribeConnection = wsService.onConnectionChange((connected) => {
            setIsConnected(connected);
        });

        return () => {
            unsubscribeConnection();
        };
    }, []);

    // Подписки на комнату и гильдию
    useEffect(() => {
        if (options.currentRoomId) {
            wsService.subscribeRoom(options.currentRoomId);
            return () => {
                wsService.unsubscribeRoom(options.currentRoomId as number);
            };
        }
    }, [options.currentRoomId]);

    useEffect(() => {
        if (options.currentGuildId) {
            wsService.subscribeGuild(options.currentGuildId);
            return () => {
                wsService.unsubscribeGuild(options.currentGuildId as number);
            };
        }
    }, [options.currentGuildId]);

    // Регистрация обработчиков
    useEffect(() => {
        const unsubscribes: (() => void)[] = [];

        if (options.onNewMessage) {
            unsubscribes.push(wsService.on('new_message', options.onNewMessage));
        }
        if (options.onUserOnline) {
            unsubscribes.push(wsService.on('user_online', options.onUserOnline));
        }
        if (options.onUserOffline) {
            unsubscribes.push(wsService.on('user_offline', options.onUserOffline));
        }
        if (options.onUserStatusChanged) {
            unsubscribes.push(wsService.on('user_status_changed', options.onUserStatusChanged));
        }
        if (options.onRoomCreated) {
            unsubscribes.push(wsService.on('room_created', options.onRoomCreated));
        }
        if (options.onRoomUpdated) {
            unsubscribes.push(wsService.on('room_updated', options.onRoomUpdated));
        }
        if (options.onRoomDeleted) {
            unsubscribes.push(wsService.on('room_deleted', options.onRoomDeleted));
        }

        return () => {
            unsubscribes.forEach(unsubscribe => unsubscribe());
        };
    }, [
        options.onNewMessage,
        options.onUserOnline,
        options.onUserOffline,
        options.onUserStatusChanged,
        options.onRoomCreated,
        options.onRoomUpdated,
        options.onRoomDeleted
    ]);

    return {
        isConnected,
        wsRef: { current: null } as React.MutableRefObject<WebSocket | null>,
        lastMessage: null,
        subscribeToRoom: wsService.subscribeRoom.bind(wsService),
        unsubscribeFromRoom: wsService.unsubscribeRoom.bind(wsService),
        subscribeToGuild: wsService.subscribeGuild.bind(wsService),
        unsubscribeFromGuild: wsService.unsubscribeGuild.bind(wsService),
    };
}