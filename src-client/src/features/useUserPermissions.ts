// src/features/useUserPermissions.ts
import { useEffect, useState } from 'react';
import { storeAPI } from './useStore';
import { apiService } from './api.service';

export enum Permission {
    EDIT_GUILD = 1 << 1,        // 2 - Редактировать канал
    CREATE_ROOMS = 1 << 2,      // 4 - Создавать комнаты в канале
    EDIT_ROOMS = 1 << 3,        // 8 - Редактировать комнаты канала
    SEND_MESSAGES = 1 << 4,     // 16 - Писать сообщения в комнате
}

export function useUserPermissions(guildId: number | null, roomId?: number) {
    const [permissions, setPermissions] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [hasEditGuild, setHasEditGuild] = useState(false);
    const [hasCreateRooms, setHasCreateRooms] = useState(false);
    const [hasEditRooms, setHasEditRooms] = useState(false);
    const [hasSendMessages, setHasSendMessages] = useState(false);

    useEffect(() => {
        const loadPermissions = async () => {
            if (!guildId) {
                setIsLoading(false);
                return;
            }

            try {
                const userId = await storeAPI.get<number>('user_id');
                if (!userId) {
                    setIsLoading(false);
                    return;
                }

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

        loadPermissions();
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