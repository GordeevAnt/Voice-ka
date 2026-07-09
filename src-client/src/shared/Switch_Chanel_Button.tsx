import "./Switch_Chanel_Button.css"
import { useEffect, useState } from "react"
import { storeAPI } from "../features/useStore"
import { apiService } from "../features/api.service"

interface SwitchChanelButtonProps {
    guildId: number;
    icon: string;
    isActive: boolean;
    onSelect: (guildId: number) => void;
    guildName?: string;
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
    onSelect,
    guildName = ""
}: SwitchChanelButtonProps) {
    const [userRoles, setUserRoles] = useState<UserRole[]>([]);
    const [userPermissions, setUserPermissions] = useState<number>(0);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [hasAdminAccess, setHasAdminAccess] = useState(false);

    // Функция для получения инициалов
    const getInitials = (name: string) => {
        if (!name) return "?";
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Функция для получения цвета аватара
    const getAvatarColor = (name: string) => {
        const colors = [
            '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
            '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
            '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#f39c12',
            '#d35400', '#c0392b', '#bdc3c7', '#7f8c8d'
        ];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    // Загружаем роли пользователя
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
                
                const roles = await apiService.getUserRolesInGuild(userId, guildId);
                console.log(`✅ Loaded roles:`, roles);
                
                setUserRoles(roles);
                
                let totalPermissions = 0;
                for (const role of roles) {
                    totalPermissions |= role.permissions;
                }
                setUserPermissions(totalPermissions);
                
                const hasAdmin = roles.some(role => 
                    role.name === 'Admin' || 
                    role.name === 'admin' ||
                    (role.permissions & 0x8) !== 0
                );
                setHasAdminAccess(hasAdmin);
                
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

    // Проверяем, есть ли иконка
    const hasIcon = icon && icon !== "/voice-ka.svg";
    
    // Получаем цвет для кнопки
    const avatarColor = getAvatarColor(guildName || `guild-${guildId}`);

    return (
        <button 
            id={`guild-${guildId}`} 
            className={getButtonClass()}
            onClick={handleClick}
            disabled={isActive || isLoadingRoles}
            style={{ '--hover-color': avatarColor } as React.CSSProperties}
        >
            {hasIcon ? (
                <img src={icon} alt={`Channel ${guildId}`} />
            ) : (
                <div 
                    className="switch-chanel-initials"
                    style={{ backgroundColor: avatarColor }}
                >
                    {getInitials(guildName || `guild-${guildId}`)}
                </div>
            )}
        </button>
    )
}