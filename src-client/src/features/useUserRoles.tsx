// src/features/useUserRoles.ts
import { useEffect, useState } from 'react';
import { storeAPI } from './useStore';

interface UserRole {
    id: number;
    name: string;
    permissions: number;
    color?: string;
    position?: number;
}

interface GuildRolesData {
    guildId: number;
    roles: UserRole[];
    permissions: number;
    hasAdmin: boolean;
    userId: number;
    updatedAt: number;
}

export function useUserRoles(guildId: number | null) {
    const [roles, setRoles] = useState<UserRole[]>([]);
    const [permissions, setPermissions] = useState<number>(0);
    const [hasAdmin, setHasAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [cachedData, setCachedData] = useState<GuildRolesData | null>(null);

    useEffect(() => {
        const loadRolesFromStorage = async () => {
            if (!guildId) {
                setRoles([]);
                setPermissions(0);
                setHasAdmin(false);
                setIsLoading(false);
                return;
            }

            try {
                // Пытаемся загрузить из хранилища
                const storedData = await storeAPI.get<GuildRolesData>(`guild_${guildId}_user_roles`);
                
                if (storedData && storedData.guildId === guildId) {
                    console.log(`📦 Loaded roles for guild ${guildId} from cache`);
                    setCachedData(storedData);
                    setRoles(storedData.roles);
                    setPermissions(storedData.permissions);
                    setHasAdmin(storedData.hasAdmin);
                } else {
                    // Если нет в кэше, очищаем
                    setRoles([]);
                    setPermissions(0);
                    setHasAdmin(false);
                }
            } catch (error) {
                console.error('Error loading roles from storage:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadRolesFromStorage();
    }, [guildId]);

    const checkPermission = (requiredPermission: number): boolean => {
        return (permissions & requiredPermission) !== 0;
    };

    const hasRole = (roleName: string): boolean => {
        return roles.some(role => role.name === roleName);
    };

    const getHighestRole = (): UserRole | null => {
        if (roles.length === 0) return null;
        return roles.reduce((highest, current) => 
            (current.position || 0) > (highest.position || 0) ? current : highest
        );
    };

    return {
        roles,
        permissions,
        hasAdmin,
        isLoading,
        cachedData,
        checkPermission,
        hasRole,
        getHighestRole,
        isAdmin: hasAdmin,
        isModerator: hasRole('Moderator') || hasRole('moderator'),
    };
}