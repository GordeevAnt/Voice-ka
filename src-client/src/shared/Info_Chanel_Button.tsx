import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { storeAPI } from "../features/useStore";
import { wsService } from "../features/websocket.service";

import "./Info.css";

interface GuildData {
    id: number;
    name: string;
    icon: string | null;
}

export default function Info_Chanel_Button() {
    const [guild, setGuild] = useState<GuildData | null>(null);
    const [currentGuildId, setCurrentGuildId] = useState<number | null>(null);

    const loadGuildData = async () => {
        const guildId = await storeAPI.get<number>('current_guild_id');
        const guildName = await storeAPI.get<string>('current_guild_name');
        const guildIcon = await storeAPI.get<string | null>('current_guild_icon');

        if (guildId && guildName) {
            setCurrentGuildId(guildId);
            setGuild({
                id: guildId,
                name: guildName,
                icon: guildIcon || null
            });
            console.log('✅ Guild data loaded:', { guildId, guildName, guildIcon });
        } else {
            setCurrentGuildId(null);
            setGuild(null);
            console.log('⚠️ No guild data in store');
        }
    };

    useEffect(() => {
        loadGuildData();

        // 👇 Подписываемся на обновления гильдии
        const unsubscribeGuildUpdated = wsService.on('guild_updated', (updatedGuild) => {
            console.log('🔄 Guild updated via WS:', updatedGuild);
            // Проверяем, что это текущая гильдия
            if (currentGuildId && updatedGuild.id === currentGuildId) {
                setGuild(prev => prev ? {
                    ...prev,
                    name: updatedGuild.name || prev.name,
                    icon: updatedGuild.icon !== undefined ? updatedGuild.icon : prev.icon
                } : null);
                
                // Обновляем данные в хранилище
                storeAPI.set('current_guild_name', updatedGuild.name);
                if (updatedGuild.icon !== undefined) {
                    storeAPI.set('current_guild_icon', updatedGuild.icon);
                }
            }
        });

        // 👇 Подписываемся на создание новой гильдии
        const unsubscribeGuildCreated = wsService.on('guild_created', (newGuild) => {
            console.log('🆕 Guild created via WS:', newGuild);
            loadGuildData();
        });

        // 👇 Подписываемся на событие смены гильдии
        const unsubscribeGuildSwitched = wsService.on('guild_switched', (data) => {
            console.log('🔄 Guild switched, reloading data');
            loadGuildData();
        });

        return () => {
            unsubscribeGuildUpdated();
            unsubscribeGuildCreated();
            unsubscribeGuildSwitched();
        };
    }, [currentGuildId]);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

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

    if (!guild) return null;

    return (
        <Link to="/chanel_info">
            <div className="chanel-info-btn">
                {guild.icon ? (
                    <img src={guild.icon} alt={guild.name} className="chanel-info-icon" />
                ) : (
                    <div 
                        className="chanel-info-icon"
                        style={{ backgroundColor: getAvatarColor(guild.name) }}
                    >
                        {getInitials(guild.name)}
                    </div>
                )}
            </div>
        </Link>
    );
}