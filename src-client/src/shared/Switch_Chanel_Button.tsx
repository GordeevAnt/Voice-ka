import "./Switch_Chanel_Button.css"
import { useEffect, useState } from "react"
import { storeAPI } from "../features/useStore"
import { apiService } from "../features/api.service"

interface SwitchChanelButtonProps {
    guildId: number;
    icon: string;
    isActive: boolean;
    onSelect: (guildId: number) => void;
}

interface UserRole {
    id: number;
    name: string;
    permissions: number;
    color?: string;
}

export function Switch_Chanel_Button({ 
    guildId, 
    icon, 
    isActive, 
    onSelect 
}: SwitchChanelButtonProps) {
    const [userRoles, setUserRoles] = useState<UserRole[]>([]);
    const [userPermissions, setUserPermissions] = useState<number>(0);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [hasAdminAccess, setHasAdminAccess] = useState(false);

    // Загружаем роли пользователя при монтировании или изменении guildId
    useEffect(() => {
        const loadUserRoles = async () => {
            setIsLoadingRoles(true);
            try {
                const userId = await storeAPI.get<number>('user_id');
                if (!userId) {
                    console.warn('No user ID found');
                    return;
                }

                console.log(`📋 Loading roles for user ${userId} in guild ${guildId}`);
                
                // Получаем роли пользователя в гильдии
                const roles = await apiService.getUserRolesInGuild(userId, guildId);
                console.log(`✅ Loaded roles:`, roles);
                
                setUserRoles(roles);
                
                // Вычисляем общие права (суммируем права всех ролей)
                let totalPermissions = 0;
                for (const role of roles) {
                    totalPermissions |= role.permissions;
                }
                setUserPermissions(totalPermissions);
                
                // Проверяем наличие административных прав
                const hasAdmin = roles.some(role => 
                    role.name === 'Admin' || 
                    role.name === 'admin' ||
                    (role.permissions & 0x8) !== 0 // Бит администратора
                );
                setHasAdminAccess(hasAdmin);
                
                // Сохраняем данные о ролях в хранилище для текущей гильдии
                await storeAPI.set(`guild_${guildId}_user_roles`, {
                    roles: roles,
                    permissions: totalPermissions,
                    hasAdmin: hasAdmin,
                    userId: userId,
                    loadedAt: Date.now()
                });
                
                console.log(`💾 Saved roles for guild ${guildId} to storage`);
                
            } catch (error) {
                console.error('Error loading user roles:', error);
            } finally {
                setIsLoadingRoles(false);
            }
        };
        
        loadUserRoles();
    }, [guildId]);

    const handleClick = async () => {
        console.log(`🔄 Switch_Chanel_Button clicked: switching to guild ${guildId}`);
        
        // При переключении канала сохраняем текущие роли в глобальное хранилище
        try {
            const userId = await storeAPI.get<number>('user_id');
            if (userId) {
                await storeAPI.set('current_guild_roles', {
                    guildId: guildId,
                    roles: userRoles,
                    permissions: userPermissions,
                    hasAdmin: hasAdminAccess,
                    userId: userId,
                    updatedAt: Date.now()
                });
                console.log(`💾 Saved current guild roles for guild ${guildId}`);
            }
        } catch (error) {
            console.error('Error saving current guild roles:', error);
        }
        
        onSelect(guildId);
    };

    // Определяем классы для кнопки на основе ролей
    const getButtonClass = () => {
        let classes = 'switch-chanel-btn';
        if (isActive) classes += ' active';
        if (hasAdminAccess) classes += ' admin';
        if (userRoles.some(role => role.name === 'Moderator')) classes += ' moderator';
        return classes;
    };

    return (
        <button 
            id={`guild-${guildId}`} 
            className={getButtonClass()}
            onClick={handleClick}
            disabled={isActive || isLoadingRoles}
            title={isLoadingRoles ? 'Loading roles...' : userRoles.map(r => r.name).join(', ')}
        >
            <img src={icon} alt={`Channel ${guildId}`} />
            {isLoadingRoles && <span className="loading-indicator">...</span>}
        </button>
    )
}