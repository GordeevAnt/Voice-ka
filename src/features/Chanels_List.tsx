import { useState, useEffect } from "react";
import { Switch_Chanel_Button } from "../shared/Switch_Chanel_Button";
import { Add_Chanel } from "../shared/Add_Chanel";
import { invoke } from "@tauri-apps/api/core";
import "./Chanels_List.css";
import { SearchGuildModal } from "../shared/SearchGuildModal";

// Интерфейс канала
interface Guild {
    id: number;
    name: string;
    icon: string | null;
    owner_id: number;
    description: string | null;
}

// Виджет вывода списка комнат канала
export function Chanels_List() {
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

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
            const userId = localStorage.getItem('user_id');
            
            if (!userId) {
                console.error("Пользователь не авторизован");
                setLoading(false);
                return;
            }
            
            const guildsData = await invoke<Guild[]>("get_user_guilds", { 
                userId: parseInt(userId) 
            });
            
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

    const handleAddChanel = () => {
        setIsSearchModalOpen(true);
    };

    const handleGuildJoined = () => {
        // Обновляем список каналов после присоединения
        fetchGuilds();
    };

    if (loading) {
        return (
            <footer className="chanels-container">
                <div className="loading">Загрузка каналов...</div>
            </footer>
        );
    }

    return (
        <>
            <footer className="chanels-container">
                <div className="chanel-list-block">
                    <div className="chanel-list">
                        {guilds.map((guild) => (
                            <Switch_Chanel_Button
                                key={guild.id}
                                guildId={guild.id}
                                icon={getIcon(guild.icon)}
                            />
                        ))}
                    </div>
                </div>
                
                <Add_Chanel onClick={handleAddChanel} />
            </footer>

            <SearchGuildModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                onGuildJoined={handleGuildJoined}
            />
        </>
    );
}