// Main_Page.tsx
import { Messenger_Field } from "../widgets/Messenger_Field"
import Info_Chanel_Button from "../shared/Info_Chanel_Button"
import Info_Room_Button from "../shared/Info_Room_Button"
import Info_Personal_Account_Button from "../shared/Info_Personal_Account_Button"
import { Rooms_Online_List } from "../widgets/Rooms_Online_List"
import { Rooms_List } from "../features/Rooms_List"

import "./Main_Page.css"
import { Chanels_List } from "../features/Chanels_List"
import { Logout } from "../entities/Logout"
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { storeAPI } from "../features/useStore"
import { invoke } from "@tauri-apps/api/core"

export function Main_Page() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [currentGuildId, setCurrentGuildId] = useState<number | null>(null);
    const [currentRoomId, setCurrentRoomId] = useState<number | undefined>(undefined);
    const [currentUserId, setCurrentUserId] = useState<number>(1);

    useEffect(() => {
        const loadUserData = async () => {
            console.log('Main_Page: Loading user data...');
            
            const token = await storeAPI.get('token');
            const userId = await storeAPI.get('user_id');
            const sessionId = await storeAPI.get('session_id');
            
            console.log('Stored data:', { token, userId, sessionId });
            
            if (!token || !userId || !sessionId) {
                console.log('No token or user_id, redirecting to auth');
                navigate('/', { replace: true });
                return;
            }
            
            try {
                const currentUser = await invoke("get_current_user", { 
                    sessionId: sessionId 
                });
                console.log('Current user in Main:', currentUser);
            } catch (error) {
                console.error('Failed to get current user:', error);
                navigate('/', { replace: true });
                return;
            }
            
            setCurrentUserId(parseInt(userId as string));
            
            const savedGuildId = await storeAPI.get('current_guild_id');
            if (savedGuildId) {
                setCurrentGuildId(parseInt(savedGuildId as string));
            }
            
            const savedRoomId = await storeAPI.get('current_room_id');
            if (savedRoomId) {
                setCurrentRoomId(parseInt(savedRoomId as string));
            }
            
            setIsLoading(false);
        };
        
        loadUserData();
    }, [navigate]);

    const handleGuildSelect = useCallback(async (guildId: number) => {
        setCurrentGuildId(guildId);
        await storeAPI.set('current_guild_id', guildId.toString());
        setCurrentRoomId(undefined);
        await storeAPI.delete('current_room_id');
    }, []);

    const handleRoomSelect = useCallback(async (roomId: number) => {
        setCurrentRoomId(roomId);
        await storeAPI.set('current_room_id', roomId.toString());
        console.log('Выбрана комната:', roomId);
    }, []);

    if (isLoading) {
        return <div className="loading-container">Загрузка...</div>;
    }

    if (!currentGuildId) {
        return (
            <div className="main-page-container">
                <div className="main-container">
                    <div className="welcome-placeholder">
                        <h2>Добро пожаловать!</h2>
                    </div>
                </div>
                <Chanels_List 
                    currentGuildId={currentGuildId ?? undefined}
                    onGuildSelect={handleGuildSelect}
                />
            </div>
        )
    }

    return (
        <div className="main-page-container">
            
            <div className="main-container">

                {currentRoomId ? (
                    <Messenger_Field 
                        key={`messenger-${currentGuildId}-${currentRoomId}`}
                        roomId={currentRoomId} 
                        currentUserId={currentUserId} 
                    />
                ) : (
                    <div className="messenger-field"></div>
                )}

                <div className="room-container">
                    
                    <div className="settings">
                        <Info_Chanel_Button />
                        <Info_Room_Button />
                        <Info_Personal_Account_Button />
                        <Logout />
                    </div>
                    
                    <div className="room-selector">
                        <Rooms_Online_List 
                            key={`online-${currentGuildId}`}
                            guildId={currentGuildId}
                        />
                        <Rooms_List 
                            key={`rooms-${currentGuildId}`}
                            guildId={currentGuildId}
                            currentRoomId={currentRoomId}
                            onRoomSelect={handleRoomSelect}
                        />
                    </div>
                
                </div>

            </div>

            <Chanels_List 
                currentGuildId={currentGuildId}
                onGuildSelect={handleGuildSelect}
            />
        
        </div>
    )
}