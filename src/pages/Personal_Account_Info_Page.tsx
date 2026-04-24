// pages/Personal_Account_Info_Page.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import "./Info_Pages.css";

interface User {
    id: number;
    username: string;
    email: string;
    avatar: string | null;
    status: string;
}

interface UserStats {
    total_messages: number;
    total_voice_time: number;
    total_guilds: number;
    registration_date: string;
    last_seen: string;
}

interface Guild {
    id: number;
    name: string;
    icon: string | null;
    role: string;
}

export function Personal_Account_Info_Page() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        username: "",
        email: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    const userId = parseInt(localStorage.getItem('user_id') || '0');
    const sessionId = localStorage.getItem('session_id') || '';

    useEffect(() => {
        loadUserInfo();
        loadUserStats();
        loadUserGuilds();
    }, []);

    const loadUserInfo = async () => {
        try {
            const userData = await invoke<User>("get_current_user", { sessionId });
            setUser(userData);
            setEditData({
                username: userData.username,
                email: userData.email,
                currentPassword: "",
                newPassword: "",
                confirmPassword: ""
            });
        } catch (err) {
            console.error("Ошибка загрузки информации о пользователе:", err);
        }
    };

    const loadUserStats = async () => {
        try {
            const statsData = await invoke<UserStats>("get_user_stats", { userId });
            setStats(statsData);
        } catch (err) {
            console.error("Ошибка загрузки статистики:", err);
        }
    };

    const loadUserGuilds = async () => {
        try {
            const guildsData = await invoke<Guild[]>("get_user_guilds", { userId });
            setGuilds(guildsData);
        } catch (err) {
            console.error("Ошибка загрузки каналов:", err);
        } finally {
            setLoading(false);
        }
    };

    // const handleUpdateProfile = async () => {
    //     if (editData.newPassword && editData.newPassword !== editData.confirmPassword) {
    //         alert("Новые пароли не совпадают");
    //         return;
    //     }

    //     try {
    //         await invoke("update_user_profile", {
    //             userId,
    //             username: editData.username,
    //             email: editData.email,
    //             currentPassword: editData.currentPassword,
    //             newPassword: editData.newPassword || null
    //         });
            
    //         alert("Профиль успешно обновлен!");
    //         setIsEditing(false);
    //         loadUserInfo(); // Перезагружаем данные
    //     } catch (err) {
    //         console.error("Ошибка обновления профиля:", err);
    //         alert(err instanceof Error ? err.message : "Ошибка обновления профиля");
    //     }
    // };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'online': return 'В сети';
            case 'idle': return 'Отошел';
            case 'dnd': return 'Не беспокоить';
            case 'offline': return 'Не в сети';
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online': return '#43b581';
            case 'idle': return '#faa61a';
            case 'dnd': return '#f04747';
            case 'offline': return '#747f8d';
            default: return '#747f8d';
        }
    };

    const formatVoiceTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}ч ${minutes}м`;
    };

    if (loading) {
        return (
            <div className="personal-acc-info-page">
                <div className="loading-container">Загрузка...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="personal-acc-info-page">
                <div className="error-container">
                    <h2>Пользователь не найден</h2>
                    <button onClick={() => navigate('/main')}>Вернуться назад</button>
                </div>
            </div>
        );
    }

    return (
        <div className="personal-acc-info-page">
            <div className="personal-info-header">
                <button className="back-btn" onClick={() => navigate('/main')}>← Назад</button>
                <h1>Личный кабинет</h1>
            </div>

            <div className="personal-info-content">
                {!isEditing ? (
                    <>
                        <div className="user-profile-header">
                            <div className="user-avatar-large">
                                {user.avatar ? (
                                    <img src={user.avatar ? "./voice-ka.svg" : user.avatar}/>
                                ) : (
                                    <div className="avatar-placeholder-large">
                                        {user.username[0]?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="user-status-indicator">
                                <span 
                                    className="status-dot"
                                    style={{ backgroundColor: getStatusColor(user.status) }}
                                />
                                <span className="status-text">{getStatusText(user.status)}</span>
                            </div>
                        </div>

                        <div className="user-info-section">
                            <h2>{user.username}</h2>
                            
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-value">{stats?.total_messages || 0}</div>
                                    <div className="stat-label">Сообщений</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{formatVoiceTime(stats?.total_voice_time || 0)}</div>
                                    <div className="stat-label">В голосовых каналах</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats?.total_guilds || 0}</div>
                                    <div className="stat-label">Каналов</div>
                                </div>
                            </div>
                            
                            <div className="info-row">
                                <label>Дата регистрации:</label>
                                <span>{stats ? new Date(stats.registration_date).toLocaleDateString() : "Неизвестно"}</span>
                            </div>
                            
                            <div className="info-row">
                                <label>Последний визит:</label>
                                <span>{stats ? new Date(stats.last_seen).toLocaleString() : "Неизвестно"}</span>
                            </div>
                        </div>

                        {/* <div className="user-guilds-section">
                            <h3>Мои каналы ({guilds.length})</h3>
                            <div className="guilds-grid">
                                {guilds.map((guild) => (
                                    <div key={guild.id} className="guild-card">
                                        <div className="guild-icon">
                                            {guild.icon ? (
                                                <img src={guild.icon} alt={guild.name} />
                                            ) : (
                                                <div className="guild-icon-placeholder">
                                                    {guild.name[0]?.toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="guild-info">
                                            <div className="guild-name">{guild.name}</div>
                                            <div className="guild-role">{guild.role}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div> */}

                        {/* <div className="profile-actions">
                            <button 
                                className="edit-profile-btn"
                                onClick={() => setIsEditing(true)}
                            >
                                ✏️ Редактировать профиль
                            </button>
                        </div> */}
                    </>
                ) : (
                    <div className="edit-profile-form">
                        <h3>Редактирование профиля</h3>
                        
                        <div className="form-group">
                            <label>Имя пользователя:</label>
                            <input
                                type="text"
                                value={editData.username}
                                onChange={(e) => setEditData({...editData, username: e.target.value})}
                                minLength={3}
                                maxLength={32}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Email:</label>
                            <input
                                type="email"
                                value={editData.email}
                                onChange={(e) => setEditData({...editData, email: e.target.value})}
                            />
                        </div>
                        
                        <div className="form-divider">Смена пароля</div>
                        
                        <div className="form-group">
                            <label>Текущий пароль:</label>
                            <input
                                type="password"
                                value={editData.currentPassword}
                                onChange={(e) => setEditData({...editData, currentPassword: e.target.value})}
                                placeholder="Введите текущий пароль"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Новый пароль:</label>
                            <input
                                type="password"
                                value={editData.newPassword}
                                onChange={(e) => setEditData({...editData, newPassword: e.target.value})}
                                placeholder="Оставьте пустым, чтобы не менять"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Подтвердите новый пароль:</label>
                            <input
                                type="password"
                                value={editData.confirmPassword}
                                onChange={(e) => setEditData({...editData, confirmPassword: e.target.value})}
                                placeholder="Повторите новый пароль"
                            />
                        </div>
                        
                        {/* <div className="form-buttons">
                            <button onClick={handleUpdateProfile} className="save-btn">
                                💾 Сохранить
                            </button>
                            <button onClick={() => setIsEditing(false)} className="cancel-btn">
                                ❌ Отмена
                            </button>
                        </div> */}
                    </div>
                )}
            </div>
        </div>
    );
}