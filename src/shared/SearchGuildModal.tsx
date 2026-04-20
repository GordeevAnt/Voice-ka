// src/components/shared/SearchGuildModal.tsx

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./SearchGuildModal.css";

interface SearchGuildModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGuildFound?: (guild: any) => void;
    onGuildJoined?: () => void;
}

interface GuildInfo {
    id: number;
    name: string;
    icon: string | null;
    owner_id: number;
    description: string | null;
}

export function SearchGuildModal({ 
    isOpen, 
    onClose, 
    onGuildFound,
    onGuildJoined 
}: SearchGuildModalProps) {
    const [guildId, setGuildId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [foundGuild, setFoundGuild] = useState<GuildInfo | null>(null);
    const [joining, setJoining] = useState(false);

    if (!isOpen) return null;

    const handleSearch = async () => {
        if (!guildId.trim()) {
            setError("Введите ID канала");
            return;
        }

        const id = parseInt(guildId);
        if (isNaN(id)) {
            setError("ID должен быть числом");
            return;
        }

        setLoading(true);
        setError(null);
        setFoundGuild(null);

        try {
            const guild = await invoke<GuildInfo | null>("find_guild_by_id", { 
                guildId: id 
            });

            if (guild) {
                setFoundGuild(guild);
                onGuildFound?.(guild);
            } else {
                setError(`Канал с ID ${id} не найден`);
            }
        } catch (err) {
            setError(`Ошибка поиска: ${err}`);
            console.error("Ошибка поиска канала:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!foundGuild) return;

        const userId = localStorage.getItem('user_id');
        if (!userId) {
            setError("Пользователь не авторизован");
            return;
        }

        setJoining(true);
        setError(null);

        try {
            await invoke("join_guild_by_id", {
                userId: parseInt(userId),
                guildId: foundGuild.id
            });

            // Успешно присоединились
            onGuildJoined?.();
            onClose();
            
            // Перезагружаем страницу или обновляем список каналов
            window.location.reload();
        } catch (err) {
            setError(`Ошибка присоединения: ${err}`);
            console.error("Ошибка присоединения к каналу:", err);
        } finally {
            setJoining(false);
        }
    };

    const handleClose = () => {
        setGuildId("");
        setError(null);
        setFoundGuild(null);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Поиск канала</h2>
                    <button className="close-button" onClick={handleClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="search-input-group">
                        <input
                            type="text"
                            placeholder="Введите ID канала..."
                            value={guildId}
                            onChange={(e) => setGuildId(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            autoFocus
                        />
                        <button 
                            onClick={handleSearch} 
                            disabled={loading}
                            className="search-button"
                        >
                            {loading ? "Поиск..." : "Найти"}
                        </button>
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {foundGuild && (
                        <div className="guild-info">
                            <h3>Найден канал:</h3>
                            <div className="guild-details">
                                <div className="guild-icon">
                                    {foundGuild.icon ? (
                                        <img src={foundGuild.icon} alt={foundGuild.name} />
                                    ) : (
                                        <div className="default-icon">🎤</div>
                                    )}
                                </div>
                                <div className="guild-info-text">
                                    <div className="guild-name">{foundGuild.name}</div>
                                    <div className="guild-id">ID: {foundGuild.id}</div>
                                    {foundGuild.description && (
                                        <div className="guild-description">{foundGuild.description}</div>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={handleJoin}
                                disabled={joining}
                                className="join-button"
                            >
                                {joining ? "Присоединение..." : "Присоединиться к каналу"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}