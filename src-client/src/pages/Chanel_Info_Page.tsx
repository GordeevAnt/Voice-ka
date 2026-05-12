// pages/Chanel_Info_Page.tsx
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiService } from "../features/api.service";
import { storeAPI } from "../features/useStore";
import { wsService } from "../features/websocket.service";
import { useUserPermissions } from "../features/useUserPermissions";
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
    const location = useLocation();
    const [guild, setGuild] = useState<Guild | null>(null);
    const [members, setMembers] = useState<GuildMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [guildId, setGuildId] = useState<number>(0);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: "",
        description: ""
    });
    
    const { hasEditGuild, isLoading: permissionsLoading } = useUserPermissions(guildId);
    const guildIdRef = useRef(guildId);

    useEffect(() => {
        guildIdRef.current = guildId;
    }, [guildId]);

    useEffect(() => {
        const unsubscribeGuildUpdated = wsService.on('guild_updated', (updatedGuild) => {
            console.log('🔄 Guild updated via WS:', updatedGuild);
            if (updatedGuild.id === guildIdRef.current) {
                setGuild(updatedGuild);
                setEditData({
                    name: updatedGuild.name,
                    description: updatedGuild.description || ""
                });
            }
        });
        
        const unsubscribeUserProfileUpdated = wsService.on('user_profile_updated', (userData) => {
            console.log('👤 User profile updated via WS:', userData);
            setMembers(prev => prev.map(member => 
                member.user_id === userData.user_id 
                    ? { ...member, username: userData.username, avatar: userData.avatar }
                    : member
            ));
        });
        
        const unsubscribeUserJoinedGuild = wsService.on('user_joined_guild', (userData) => {
            console.log('👋 User joined guild via WS:', userData);
            // Добавляем нового участника в список, если его там ещё нет
            setMembers(prev => {
                const exists = prev.some(m => m.user_id === userData.user_id);
                if (exists) return prev;
                return [...prev, {
                    user_id: userData.user_id,
                    username: userData.username,
                    avatar: userData.avatar,
                    nickname: null,
                    joined_at: new Date().toISOString()
                }];
            });
        });
        
        return () => {
            unsubscribeGuildUpdated();
            unsubscribeUserProfileUpdated();
            unsubscribeUserJoinedGuild();
        };
    }, []);

    useEffect(() => {
        if (!guildId) return;
        
        const unsubscribeGuildUpdated = wsService.on('guild_updated', (updatedGuild) => {
            console.log('🔄 Guild updated via WS:', updatedGuild);
            if (updatedGuild.id === guildId) {
                setGuild(updatedGuild);
                setEditData({
                    name: updatedGuild.name,
                    description: updatedGuild.description || ""
                });
            }
        });
        
        const unsubscribeUserProfileUpdated = wsService.on('user_profile_updated', (userData) => {
            console.log('👤 User profile updated via WS:', userData);
            setMembers(prev => prev.map(member => 
                member.user_id === userData.user_id 
                    ? { ...member, username: userData.username, avatar: userData.avatar }
                    : member
            ));
        });
        
        return () => {
            unsubscribeGuildUpdated();
            unsubscribeUserProfileUpdated();
        };
    }, [guildId]);

    useEffect(() => {
        if (guildId) {
            console.log('📡 Chanel_Info_Page subscribing to guild:', guildId);
            wsService.subscribeGuild(guildId);
        }
        
        return () => {
            if (guildId) {
                console.log('📡 Chanel_Info_Page unsubscribing from guild:', guildId);
                wsService.unsubscribeGuild(guildId);
            }
        };
    }, [guildId]);

    useEffect(() => {
        const loadData = async () => {
            await wsService.waitForAuth();
            
            const storedGuildId = await storeAPI.get<number>('current_guild_id');
            
            if (storedGuildId) {
                setGuildId(storedGuildId);
            } else {
                setLoading(false);
            }
        };
        
        loadData();
    }, []);

    useEffect(() => {
        if (guildId) {
            loadGuildInfo();
            loadGuildMembers();
        }
    }, [guildId, location.key]);

    const loadGuildInfo = async () => {
        if (!guildId) return;

        try {
            const guildData = await apiService.findGuildById(guildId);
            if (guildData) {
                setGuild(guildData);
                setEditData({
                    name: guildData.name,
                    description: guildData.description || ""
                });
            }
        } catch (err) {
            console.error("Ошибка загрузки информации о канале:", err);
        }
    };

    const loadGuildMembers = async () => {
        if (!guildId) return;

        try {
            const membersData = await apiService.getGuildMembers(guildId);
            setMembers(membersData);
        } catch (err) {
            console.error("Ошибка загрузки участников:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!guild || !editData.name.trim()) return;
        
        try {
            const updatedGuild = await apiService.updateGuild(guild.id, {
                name: editData.name,
                description: editData.description || null
            });
            
            if (updatedGuild) {
                setGuild(updatedGuild);
                setIsEditing(false);
            } else {
                alert("Ошибка при обновлении канала");
            }
        } catch (err) {
            console.error("Error saving guild:", err);
            alert(err instanceof Error ? err.message : "Ошибка сохранения");
        }
    };

    const handleBack = () => {
        navigate('/main');
    };

    if (loading || permissionsLoading) {
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
                    <h2>Канал не выбран</h2>
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
                {hasEditGuild && !isEditing && (
                    <button className="edit-btn" onClick={() => setIsEditing(true)}>
                        Редактировать
                    </button>
                )}
            </div>

            <div className="chanel-info-content">
                {!isEditing ? (
                    <>
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
                    </>
                ) : (
                    <div className="edit-guild-form">
                        <h3>Редактирование канала</h3>
                        
                        <div className="form-group">
                            <label>Название канала:</label>
                            <input
                                type="text"
                                value={editData.name}
                                onChange={(e) => setEditData({...editData, name: e.target.value})}
                                maxLength={100}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Описание:</label>
                            <textarea
                                value={editData.description}
                                onChange={(e) => setEditData({...editData, description: e.target.value})}
                                rows={4}
                                maxLength={500}
                            />
                        </div>
                        
                        <div className="form-buttons">
                            <button onClick={() => {
                                setIsEditing(false);
                                setEditData({
                                    name: guild.name,
                                    description: guild.description || ""
                                });
                            }} className="cancel-btn">
                                Отмена
                            </button>
                            <button onClick={handleSaveEdit} className="save-btn">
                                Сохранить
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}