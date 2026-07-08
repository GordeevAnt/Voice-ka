import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { storeAPI } from "../features/useStore";
import { wsService } from "../features/websocket.service";

import "./Info.css";

interface UserData {
    user_id: number;
    username: string;
    avatar: string | null;
}

export default function Info_Personal_Account_Button() {
    const [user, setUser] = useState<UserData | null>(null);

    const loadUserData = async () => {
        const userId = await storeAPI.get<number>('user_id');
        const username = await storeAPI.get<string>('username');
        const avatar = await storeAPI.get<string | null>('avatar');

        if (userId && username) {
            setUser({ 
                user_id: userId, 
                username, 
                avatar: avatar || null
            });
        }
    };

    useEffect(() => {
        loadUserData();

        const unsubscribeProfileUpdated = wsService.on('user_profile_updated', (data) => {
            if (data.user_id === user?.user_id) {
                setUser(prev => prev ? {
                    ...prev,
                    username: data.username || prev.username,
                    avatar: data.avatar !== undefined ? data.avatar : prev.avatar
                } : null);
                
                if (data.username) storeAPI.set('username', data.username);
                if (data.avatar !== undefined) storeAPI.set('avatar', data.avatar);
            }
        });

        return () => {
            unsubscribeProfileUpdated();
        };
    }, [user?.user_id]);

    const getInitials = (username: string) => {
        return username
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getAvatarColor = (username: string) => {
        const colors = [
            '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
            '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
            '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#f39c12',
            '#d35400', '#c0392b', '#bdc3c7', '#7f8c8d'
        ];
        
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    if (!user) return null;

    return (
        <div className="user-info-btn">
            <Link to="/person_acc_info" data-tooltip={user.username}>
                {user.avatar ? (
                    <img src={user.avatar} alt={user.username} className="user-info-avatar" />
                ) : (
                    <div 
                        className="user-info-avatar"
                        style={{ backgroundColor: getAvatarColor(user.username) }}
                    >
                        {getInitials(user.username)}
                    </div>
                )}
            </Link>
        </div>
    );
}