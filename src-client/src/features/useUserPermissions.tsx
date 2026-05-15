// src/features/useUserPermissions.ts

import { useEffect, useState } from 'react';
import { storeAPI } from './useStore';
import { apiService } from './api.service';
import { wsService } from './websocket.service';

export enum Permission {
    EDIT_GUILD = 1 << 1,        // 2 - Редактировать канал
    CREATE_ROOMS = 1 << 2,      // 4 - Создавать комнаты в канале
    EDIT_ROOMS = 1 << 3,        // 8 - Редактировать комнаты канала
    BAN_MEMBERS = 1 << 4,       // 16 - Блокировать участников
    KICK_MEMBERS = 1 << 5,      // 32 - Кикать участников
    SEND_MESSAGES = 1 << 6,     // 64 - Писать сообщения в комнате
}

export function useUserPermissions(guildId: number | null, roomId?: number) {
    const [permissions, setPermissions] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [hasEditGuild, setHasEditGuild] = useState(false);
    const [hasCreateRooms, setHasCreateRooms] = useState(false);
    const [hasEditRooms, setHasEditRooms] = useState(false);
    const [hasSendMessages, setHasSendMessages] = useState(false);

    // Функция загрузки прав
    const loadPermissions = async (ignoreCache = false) => {
        console.log('🔍 loadPermissions called with guildId:', guildId);
        
        if (!guildId) {
            console.log('⚠️ No guildId, skipping');
            setIsLoading(false);
            return;
        }

        try {
            const userId = await storeAPI.get<number>('user_id');
            console.log('🔍 Retrieved userId from store:', userId, 'type:', typeof userId);
            if (!userId) {
                console.log('⚠️ No userId, skipping');
                setIsLoading(false);
                return;
            }

            const cacheKey = `user_permissions_${guildId}_${userId}`;
            
            // Если нужно игнорировать кэш, удаляем его
            if (ignoreCache) {
                await storeAPI.delete(cacheKey);
            }
            
            console.log('✅ Both IDs present, sending request...');
            const perms = await apiService.getUserPermissionsInGuild(userId, guildId);
            setPermissions(perms);
            
            setHasEditGuild((perms & Permission.EDIT_GUILD) !== 0);
            setHasCreateRooms((perms & Permission.CREATE_ROOMS) !== 0);
            setHasEditRooms((perms & Permission.EDIT_ROOMS) !== 0);
            setHasSendMessages((perms & Permission.SEND_MESSAGES) !== 0);
        } catch (error) {
            console.error('Error loading permissions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPermissions();
    }, [guildId]);

    // Слушаем реальное обновление прав (когда меняются роли)
    useEffect(() => {
        if (!guildId) return;
        
        const unsubscribe = wsService.on('user_permissions_updated', (data) => {
            if (data.guild_id === guildId && data.user_id === wsService.getCurrentUserId()) {
                console.log('🔄 Real permissions update received');
                const newPermissions = data.permissions;
                setPermissions(newPermissions);
                setHasEditGuild((newPermissions & Permission.EDIT_GUILD) !== 0);
                setHasCreateRooms((newPermissions & Permission.CREATE_ROOMS) !== 0);
                setHasEditRooms((newPermissions & Permission.EDIT_ROOMS) !== 0);
                setHasSendMessages((newPermissions & Permission.SEND_MESSAGES) !== 0);
            }
        });
        
        return () => unsubscribe();
    }, [guildId]);

    const checkPermission = (permission: Permission): boolean => {
        return (permissions & permission) !== 0;
    };

    return {
        permissions,
        isLoading,
        hasEditGuild,
        hasCreateRooms,
        hasEditRooms,
        hasSendMessages,
        checkPermission,
    };
}