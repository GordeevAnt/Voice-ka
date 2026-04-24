// pages/Chanel_Info_Page.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import "./Info_Pages.css";

interface Guild {
    id: number;
    name: string;
    icon: string | null;
    owner_id: number;
    description: string | null;
}

interface GuildMember {
    user_id: number;
    username: string;
    avatar: string | null;
    nickname: string | null;
    joined_at: string;
}

export function Chanel_Info_Page() {
    const navigate = useNavigate();
    const [guild, setGuild] = useState<Guild | null>(null);
    const [members, setMembers] = useState<GuildMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);

    const guildId = parseInt(localStorage.getItem('current_guild_id') || '0');

    useEffect(() => {
        const userId = localStorage.getItem('user_id');
        if (userId) {
            setCurrentUserId(parseInt(userId));
        }
        loadGuildInfo();
        loadGuildMembers();
    }, [guildId]);

    const loadGuildInfo = async () => {
        if (!guildId) return;

        try {
            const guildData = await invoke<Guild>("find_guild_by_id", { guildId });
            if (guildData) {
                setGuild(guildData);
            }
        } catch (err) {
            console.error("Ошибка загрузки информации о канале:", err);
        }
    };

    const loadGuildMembers = async () => {
        if (!guildId) return;

        try {
            // Временно используем прямой SQL запрос через invoke
            const membersData = await invoke<GuildMember[]>("get_guild_members", { guildId });
            setMembers(membersData);
        } catch (err) {
            console.error("Ошибка загрузки участников:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        navigate('/main');
    };

    if (loading) {
        return (
            <div className="chanel-info-page">
                <div className="loading-container">Загрузка...</div>
            </div>
        );
    }

    if (!guild) {
        return (
            <div className="chanel-info-page">
                <div className="error-container">
                    <h2>Канал не найден</h2>
                    <button onClick={handleBack}>Вернуться назад</button>
                </div>
            </div>
        );
    }

    return (
        <div className="chanel-info-page">
            <div className="chanel-info-header">
                <button className="back-btn" onClick={handleBack}>← Назад</button>
                <h1>Информация о канале</h1>
            </div>

            <div className="chanel-info-content">
                <div className="chanel-main-info">
                    <div className="chanel-icon">
                        {guild.icon ? (
                            <img src={guild.icon} alt={guild.name} />
                        ) : (
                            <div className="default-icon">
                                {guild.name[0]?.toUpperCase()}
                            </div>
                        )}
                    </div>
                    
                    <div className="chanel-details">
                        <h2>{guild.name}</h2>
                        <p className="chanel-description">
                            {guild.description || "Нет описания"}
                        </p>
                        <div className="chanel-stats">
                            <span>👥 {members.length} участников</span>
                            <span>👑 Владелец: {members.find(m => m.user_id === guild.owner_id)?.username || "Неизвестен"}</span>
                        </div>
                        
                    </div>
                </div>

                <div className="chanel-members-section">
                    <h3>Участники ({members.length})</h3>
                    <div className="members-list">
                        {members.map((member) => (
                            <div key={member.user_id} className="member-item">
                                <div className="member-avatar">
                                    {member.avatar ? (
                                        <img src={member.avatar} alt={member.username} />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {member.username[0]?.toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="member-info">
                                    <span className="member-name">
                                        {member.nickname || member.username}
                                    </span>
                                    {member.user_id === guild.owner_id && (
                                        <span className="owner-badge">Владелец</span>
                                    )}
                                </div>
                                <div className="member-joined">
                                    Присоединился: {new Date(member.joined_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}