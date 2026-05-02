// Search_Chanel.tsx
import { useState } from "react";
import { apiService } from "../features/api.service";
import { storeAPI } from "../features/useStore";
import "./Search_Chanel.css";

interface GuildInfo {
    id: number;
    name: string;
    icon: string | null;
    owner_id: number;
    description: string | null;
}

interface SearchChanelProps {
    onGuildJoined?: () => void;
}

export function Search_Chanel({ onGuildJoined }: SearchChanelProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [guildId, setGuildId] = useState("");
    const [loading, setLoading] = useState(false);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [foundGuild, setFoundGuild] = useState<GuildInfo | null>(null);

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
            const guild = await apiService.findGuildById(id);
            
            if (guild) {
                setFoundGuild(guild);
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

        const userId = await storeAPI.get<number>('user_id');
        if (!userId) {
            setError("Пользователь не авторизован");
            return;
        }

        setJoining(true);
        setError(null);

        try {
            const success = await apiService.joinGuild(userId, foundGuild.id);
            
            if (success) {
                onGuildJoined?.();
                handleCloseModal();
            } else {
                setError("Не удалось присоединиться к каналу");
            }
        } catch (err) {
            setError(`Ошибка присоединения: ${err}`);
            console.error("Ошибка присоединения к каналу:", err);
        } finally {
            setJoining(false);
        }
    };

    const handleOpenModal = () => {
        setIsModalOpen(true);
        setGuildId("");
        setError(null);
        setFoundGuild(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setGuildId("");
        setError(null);
        setFoundGuild(null);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <>
            <button className="search-chanel-btn" onClick={handleOpenModal}>
                <img src="/grey-search.svg" alt="Поиск канала" />
            </button>

            {isModalOpen && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Поиск канала</h2>
                            <button className="close-button" onClick={handleCloseModal}>×</button>
                        </div>

                        <div className="modal-body">
                            <div className="search-input-group">
                                <input
                                    type="text"
                                    placeholder="Введите ID канала..."
                                    value={guildId}
                                    onChange={(e) => setGuildId(e.target.value)}
                                    onKeyPress={handleKeyPress}
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
            )}
        </>
    );
}