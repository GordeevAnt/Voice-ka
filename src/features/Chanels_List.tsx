import { useState, useEffect } from "react";
import { Switch_Chanel_Button } from "../shared/Switch_Chanel_Button";
import { invoke } from "@tauri-apps/api/core";
import "./Chanels_List.css";
import { Search_Chanel } from "../shared/Search_Chanel";
import { storeAPI } from "../features/useStore";

// Интерфейс канала
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

// Виджет вывода списка комнат канала
export function Chanels_List({ currentGuildId, onGuildSelect }: ChanelsListProps) {
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGuildName, setNewGuildName] = useState("");
    const [newGuildDescription, setNewGuildDescription] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const getIcon = (icon: string | null) => {
        if (!icon) {
            return "/voice-ka.svg";
        }
        
        if (icon.startsWith('/')) {
            return icon;
        }
        
        return `/icons/${icon}`;
    };

    // Загрузка каналов пользователя
    const fetchGuilds = async () => {
        try {
            setLoading(true);
            const userId = await storeAPI.get<string>('user_id');
            
            if (!userId) {
                console.error("Пользователь не авторизован");
                setLoading(false);
                return;
            }
            
            const guildsData = await invoke<Guild[]>("get_user_guilds", { 
                userId: parseInt(userId) 
            });
            
            console.log('📋 Loaded guilds:', guildsData);
            setGuilds(guildsData);
        } catch (err) {
            console.error("Ошибка загрузки каналов:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGuilds();
    }, []);

    const handleGuildJoined = () => {
        // Обновляем список каналов после присоединения
        fetchGuilds();
    };

    const handleGuildSelect = (guildId: number) => {
        console.log(`🔄 Chanels_List: guild selected: ${guildId}`);
        onGuildSelect(guildId);
    };

    const handleCreateGuild = async () => {
        if (!newGuildName.trim()) {
            alert("Введите название канала");
            return;
        }

        const userId = await storeAPI.get<string>('user_id');
        if (!userId) {
            alert("Пользователь не авторизован");
            return;
        }

        setIsCreating(true);
        try {
            const newGuild = await invoke<Guild>("create_guild", {
                guildData: {
                    name: newGuildName.trim(),
                    description: newGuildDescription.trim() || null,
                    owner_id: parseInt(userId),
                    icon: null
                }
            });

            // Обновляем список гильдий
            await fetchGuilds();
            
            // Закрываем модальное окно
            setShowCreateModal(false);
            setNewGuildName("");
            setNewGuildDescription("");
            
            // Автоматически выбираем новую гильдию
            if (newGuild && newGuild.id) {
                console.log(`🆕 New guild created, switching to: ${newGuild.id}`);
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
            <footer className="chanels-container">
                <div className="loading">Загрузка каналов...</div>
            </footer>
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
            <div className="chanel-list-block">
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