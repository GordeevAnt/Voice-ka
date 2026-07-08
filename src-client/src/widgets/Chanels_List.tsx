// Chanels_List.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { Switch_Chanel_Button } from "../shared/Switch_Chanel_Button";
import { apiService } from "../features/api.service";
import { storeAPI } from "../features/useStore";
import { wsService } from "../features/websocket.service";
import "./Chanels_List.css";
import { Search_Chanel } from "../shared/Search_Chanel";

interface Guild {
    id: number;
    name: string;
    icon: string | null;
    owner_id: number;
    description: string | null;
}

interface ChanelsListProps {
    currentGuildId?: number;
    onGuildSelect: (guildId: number) => void;
}

export function Chanels_List({ currentGuildId, onGuildSelect }: ChanelsListProps) {
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGuildName, setNewGuildName] = useState("");
    const [newGuildDescription, setNewGuildDescription] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const getIcon = (icon: string | null) => {
        if (!icon) return "/voice-ka.svg";
        if (icon.startsWith('/')) return icon;
        return `/icons/${icon}`;
    };

    const fetchGuilds = async () => {
        try {
            setLoading(true);
            const userId = await storeAPI.get<number>('user_id');
            
            if (!userId) {
                console.error("Пользователь не авторизован");
                setLoading(false);
                return;
            }
            
            const guildsData = await apiService.getUserGuilds(userId);
            console.log('📋 Loaded guilds:', guildsData);
            setGuilds(guildsData);
            
            // 👇 СОХРАНЯЕМ ВСЕ ГИЛЬДИИ В ХРАНИЛИЩЕ
            await storeAPI.set('user_guilds', guildsData);
            
            // 👇 СОХРАНЯЕМ ДАННЫЕ ТЕКУЩЕЙ ГИЛЬДИИ
            const currentGuildId = await storeAPI.get<number>('current_guild_id');
            if (currentGuildId) {
                const currentGuild = guildsData.find((g: any) => g.id === currentGuildId);
                if (currentGuild) {
                    await storeAPI.set('current_guild_name', currentGuild.name);
                    await storeAPI.set('current_guild_icon', currentGuild.icon || null);
                    console.log('✅ Saved current guild data:', currentGuild.name);
                }
            }
        } catch (err) {
            console.error("Ошибка загрузки каналов:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const checkScroll = () => {
            const hasScroll = container.scrollWidth > container.clientWidth;
            console.log('Has horizontal scroll:', hasScroll, 
                        'scrollWidth:', container.scrollWidth, 
                        'clientWidth:', container.clientWidth);
        };

        checkScroll();
        window.addEventListener('resize', checkScroll);
        
        return () => window.removeEventListener('resize', checkScroll);
    }, [guilds]);

    useEffect(() => {
        fetchGuilds();
        
        const unsubscribeGuildCreated = wsService.on('guild_created', (guild) => {
            console.log('🆕 New guild created via WS:', guild);
            setGuilds(prev => {
                const exists = prev.some(g => g.id === guild.id);
                if (exists) return prev;
                return [...prev, guild];
            });
            
            // Автоматически переключаемся на созданную гильдию
            if (guild && guild.id) {
                console.log(`🆕 Auto-switching to new guild: ${guild.id}`);
                // Небольшая задержка, чтобы список обновился
                setTimeout(() => {
                    onGuildSelect(guild.id);
                }, 100);
            }
        });
        
        const unsubscribeGuildUpdated = wsService.on('guild_updated', (updatedGuild) => {
            console.log('🔄 Guild updated via WS:', updatedGuild);
            setGuilds(prev => prev.map(g => 
                g.id === updatedGuild.id ? updatedGuild : g
            ));
        });
        
        const unsubscribeProfileUpdated = wsService.on('user_profile_updated', (userData) => {
            setGuilds(prev => prev.map(g =>
                g.owner_id === userData.user_id
                    ? { ...g, owner_name: userData.username }
                    : g
            ));
        });
        
        return () => {
            unsubscribeGuildCreated();
            unsubscribeGuildUpdated();
            unsubscribeProfileUpdated();
        };
    }, []);

    const handleGuildJoined = () => {
        fetchGuilds();
    };

    const handleGuildSelect = useCallback(async (guildId: number) => {
        console.log(`🔄 Chanels_List: guild selected: ${guildId}`);
        
        // Сохраняем данные выбранной гильдии
        const guild = guilds.find(g => g.id === guildId);
        if (guild) {
            await storeAPI.set('current_guild_name', guild.name);
            await storeAPI.set('current_guild_icon', guild.icon || null);
            console.log('✅ Saved selected guild data:', guild.name);
        }
        
        onGuildSelect(guildId);
    }, [guilds, onGuildSelect]);

    const handleCreateGuild = async () => {
        if (!newGuildName.trim()) {
            alert("Введите название канала");
            return;
        }

        const userId = await storeAPI.get<number>('user_id');
        if (!userId) {
            alert("Пользователь не авторизован");
            return;
        }

        setIsCreating(true);
        try {
            const newGuild = await apiService.createGuild({
                name: newGuildName.trim(),
                description: newGuildDescription.trim() || null,
                owner_id: userId,
                icon: null
            });

            // Обновляем список гильдий
            await fetchGuilds();
            
            setShowCreateModal(false);
            setNewGuildName("");
            setNewGuildDescription("");
            
            if (newGuild && newGuild.id) {
                console.log(`🆕 New guild created, switching to: ${newGuild.id}`);
                // Подписываемся на гильдию для получения обновлений
                wsService.subscribeGuild(newGuild.id);
                onGuildSelect(newGuild.id);
            }
        } catch (err) {
            console.error("Ошибка создания канала:", err);
            alert(err instanceof Error ? err.message : "Ошибка создания канала");
        } finally {
            setIsCreating(false);
        }
    };

    if (loading) {
        return (
            <>
                <footer className="chanels-container">
                    <div className="loading">Загрузка каналов...</div>
                </footer>
            </>
        );
    }

    return (
        <footer className="chanels-container">
            <button 
                className="create-guild-btn"
                onClick={() => setShowCreateModal(true)}
                title="Создать канал"
            >
                +
            </button>
            <div className="chanel-list-block" ref={scrollContainerRef}>
                <div className="chanel-list">
                    {guilds.map((guild) => (
                        <Switch_Chanel_Button
                            key={guild.id}
                            guildId={guild.id}
                            icon={getIcon(guild.icon)}
                            isActive={currentGuildId === guild.id}
                            onSelect={handleGuildSelect}
                        />
                    ))}
                </div>
            </div>
            
            <Search_Chanel onGuildJoined={handleGuildJoined} />

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content create-guild-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Создать канал</h3>
                        
                        <input
                            type="text"
                            placeholder="Название канала"
                            value={newGuildName}
                            onChange={(e) => setNewGuildName(e.target.value)}
                            maxLength={100}
                            autoFocus
                        />
                        
                        <textarea
                            placeholder="Описание (необязательно)"
                            value={newGuildDescription}
                            onChange={(e) => setNewGuildDescription(e.target.value)}
                            rows={3}
                            maxLength={500}
                        />
                        
                        <div className="modal-buttons">
                            <button onClick={() => setShowCreateModal(false)} disabled={isCreating}>
                                Отмена
                            </button>
                            <button onClick={handleCreateGuild} disabled={isCreating}>
                                {isCreating ? "Создание..." : "Создать"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </footer>
    );
}