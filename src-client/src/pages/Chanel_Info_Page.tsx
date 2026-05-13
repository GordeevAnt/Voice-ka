// pages/Chanel_Info_Page.tsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiService } from "../features/api.service";
import { storeAPI } from "../features/useStore";
import { wsService } from "../features/websocket.service";
import { useUserPermissions } from "../features/useUserPermissions";
import "./Info_Pages.css";
import { UserPermissionsModal } from "../features/UserPermissionsModal";

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
    const [selectedMember, setSelectedMember] = useState<{ id: number; username: string } | null>(null);
    const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
    
    const { hasEditGuild, isLoading: permissionsLoading } = useUserPermissions(guildId);
    const guildIdRef = useRef(guildId);

    // Функция принудительного обновления списка участников
    const refreshMembers = useCallback(async () => {
        if (!guildId) return;
        console.log('🔄 Refreshing members list for guild:', guildId);
        try {
            const membersData = await apiService.getGuildMembers(guildId);
            setMembers(membersData);
        } catch (err) {
            console.error("Ошибка обновления участников:", err);
        }
    }, [guildId]);

    // Функция добавления пользователя в список
    const addMember = useCallback((userData: any) => {
        console.log('➕ Adding member to list:', userData);
        setMembers(prev => {
            // Проверяем, не существует ли уже
            const exists = prev.some(m => m.user_id === userData.user_id);
            if (exists) return prev;
            
            // Добавляем нового участника
            const newMember: GuildMember = {
                user_id: userData.user_id,
                username: userData.username,
                avatar: userData.avatar || null,
                nickname: null,
                joined_at: new Date().toISOString()
            };
            return [...prev, newMember];
        });
    }, []);

    // Функция удаления пользователя из списка
    const removeMember = useCallback((userId: number) => {
        console.log('➖ Removing member from list:', userId);
        setMembers(prev => prev.filter(m => m.user_id !== userId));
    }, []);

    const handlePermissionsUpdated = async () => {
        console.log('🔄 Permissions updated, refreshing member roles...');
        // Обновляем список участников (чтобы обновить их роли в кэше)
        await refreshMembers();
        
        // Уведомляем через WebSocket о смене прав (сервер сам отправит уведомление)
    };

    useEffect(() => {
        guildIdRef.current = guildId;
    }, [guildId]);
    
    const handleLeaveGuild = async () => {
        if (!guild) return;
        
        try {
            const response = await wsService.request('leave_guild', {}, { guild_id: guild.id });
            
            if (response.success) {
                await storeAPI.delete('current_guild_id');
                navigate('/main');
            }
        } catch (err) {
            console.error('Error leaving guild:', err);
        }
    };

    // Единый useEffect для всех глобальных обработчиков
    useEffect(() => {
        // Обработчик обновления гильдии
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
        
        // Обработчик обновления профиля пользователя
        const unsubscribeUserProfileUpdated = wsService.on('user_profile_updated', (userData) => {
            console.log('👤 User profile updated via WS:', userData);
            setMembers(prev => prev.map(member => 
                member.user_id === userData.user_id 
                    ? { ...member, username: userData.username, avatar: userData.avatar }
                    : member
            ));
        });
        
        // Обработчик присоединения пользователя к гильдии
        const unsubscribeUserJoinedGuild = wsService.on('user_joined_guild', (userData) => {
            console.log('👋 User joined guild via WS:', userData);
            const joinedGuildId = userData.guild_id || userData.guildId;
            
            // Если пользователь присоединился к текущей гильдии
            if (joinedGuildId === guildIdRef.current) {
                // Добавляем в список участников
                addMember(userData);
            }
        });
        
        // Обработчик выхода пользователя из гильдии
        const unsubscribeUserLeftGuild = wsService.on('user_left_guild', (data) => {
            console.log('👋 User left guild via WS:', data);
            const { user_id, guild_id: leftGuildId } = data;
            
            if (leftGuildId === guildIdRef.current) {
                // Если текущий пользователь вышел
                if (user_id === wsService.getCurrentUserId()) {
                    storeAPI.delete('current_guild_id').then(() => {
                        navigate('/main');
                    });
                } else {
                    // Удаляем другого пользователя из списка
                    removeMember(user_id);
                }
            }
        });
        
        // Обработчик подтверждения выхода из гильдии
        const unsubscribeGuildLeft = wsService.on('guild_left', (data) => {
            console.log('👋 Guild left confirmation:', data);
            const { guild_id: leftGuildId, success } = data;
            
            if (success && leftGuildId === guildIdRef.current) {
                storeAPI.delete('current_guild_id').then(() => {
                    navigate('/main');
                });
            }
        });

        const unsubscribeRolePermissionsUpdated = wsService.on('role_permissions_updated', async (data) => {
            console.log('🔄 Role permissions updated via WS:', data);
            const { guild_id, role_id, permissions } = data;
            
            if (guild_id === guildIdRef.current) {
                // Обновляем права текущего пользователя, если он имеет эту роль
                const currentUserId = wsService.getCurrentUserId();
                if (currentUserId) {
                    const userRoles = await apiService.getUserRolesInGuild(currentUserId, guild_id);
                    const hasRole = userRoles.some(r => r.id === role_id);
                    
                    if (hasRole) {
                        // Обновляем права текущего пользователя
                        const newPermissions = await apiService.getUserPermissionsInGuild(currentUserId, guild_id);
                        // Уведомляем через событие, чтобы useUserPermissions обновился
                        wsService.notifyEventHandlers('user_permissions_updated', {
                            guild_id: guild_id,
                            user_id: currentUserId,
                            permissions: newPermissions
                        });
                    }
                }
                
                // Обновляем список участников, чтобы отобразить изменения
                await refreshMembers();
            }
        });
        
        return () => {
            unsubscribeGuildUpdated();
            unsubscribeUserProfileUpdated();
            unsubscribeUserJoinedGuild();
            unsubscribeUserLeftGuild();
            unsubscribeGuildLeft();
            unsubscribeRolePermissionsUpdated();
        };
    }, [navigate, addMember, removeMember]);

    // Для обновления прав целевого пользователя
    useEffect(() => {
        const unsubscribePermissionsUpdated = wsService.on('user_permissions_updated', async (data) => {
            console.log('🔄 User permissions updated via WS:', data);
            const { guild_id, user_id, permissions } = data;
            
            if (guild_id === guildIdRef.current) {
                // Если это текущая гильдия
                if (user_id === wsService.getCurrentUserId()) {
                    // Обновляем права текущего пользователя
                    // useUserPermissions сам обновится через свой хук
                    console.log('Current user permissions updated');
                }
                
                // Обновляем список участников, чтобы отобразить изменения
                await refreshMembers();
            }
        });
        
        return () => unsubscribePermissionsUpdated();
    }, [refreshMembers]);

    // Подписка на гильдию
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

    // Загрузка данных при монтировании
    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('📡 Waiting for auth...');
                await wsService.waitForAuth();
                
                console.log('📡 Getting stored guild id...');
                const storedGuildId = await storeAPI.get<number>('current_guild_id');
                console.log('📡 Stored guild id:', storedGuildId);
                
                if (storedGuildId) {
                    setGuildId(storedGuildId);
                } else {
                    console.log('📡 No guild id found, setting loading false');
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error loading data:', err);
                setLoading(false);
            }
        };
        
        loadData();
    }, []);

    // Загрузка информации о гильдии и участниках
    useEffect(() => {
        const loadData = async () => {
            if (!guildId) return;
            
            console.log('📡 Loading guild info and members for guild:', guildId);
            try {
                await loadGuildInfo();
                await refreshMembers();
            } catch (err) {
                console.error('Error loading guild data:', err);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
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
            }
        } catch (err) {
            console.error("Error saving guild:", err);
        }
    };

    const handleBack = () => {
        navigate('/main');
    };

    // Показываем загрузку только если реально загружаем данные
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
                <></>
                <button className="back-btn" onClick={handleBack}>← Назад</button>
                <h1>Информация о канале</h1>
                <div className="header-buttons">
                    {hasEditGuild && !isEditing && (
                        <button className="edit-btn" onClick={() => setIsEditing(true)}>
                            Редактировать
                        </button>
                    )}
                    {!isEditing && guild.owner_id !== wsService.getCurrentUserId() && (
                        <button className="leave-btn" onClick={handleLeaveGuild}>
                            Покинуть гильдию
                        </button>
                    )}
                </div>
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
                                <p className="chanel-id">
                                    {`ID: ${guild.id}` || ""}
                                </p>
                                <p className="chanel-description">
                                    {guild.description || "Нет описания"}
                                </p>
                                <div className="chanel-stats">
                                    <span>👥 {members.length}</span>
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

                                        {guild.owner_id === wsService.getCurrentUserId() && 
                                        member.user_id !== wsService.getCurrentUserId() && (
                                            <button 
                                                className="manage-permissions-btn"
                                                onClick={() => {
                                                    setSelectedMember({
                                                        id: member.user_id,
                                                        username: member.username
                                                    });
                                                    setIsPermissionsModalOpen(true);
                                                }}
                                                title="Управление правами"
                                            >
                                                ⚙️
                                            </button>
                                        )}  
                                    </div>
                                ))}
                            </div>
                            <UserPermissionsModal
                                isOpen={isPermissionsModalOpen}
                                onClose={() => {
                                    setIsPermissionsModalOpen(false);
                                    setSelectedMember(null);
                                }}
                                userId={selectedMember?.id || 0}
                                username={selectedMember?.username || ''}
                                guildId={guild.id}
                                onPermissionsUpdated={handlePermissionsUpdated}
                            />
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