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
import { wsService } from "../features/websocket.service"

export function Main_Page() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [currentGuildId, setCurrentGuildId] = useState<number | null>(null);
    const [currentRoomId, setCurrentRoomId] = useState<number | undefined>(undefined);
    const [currentUserId, setCurrentUserId] = useState<number>(1);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const loadUserData = async () => {
            console.log('Main_Page: Loading user data...');
            
            const token = await storeAPI.get('token');
            const userId = await storeAPI.get<number>('user_id');
            const sessionId = await storeAPI.get('session_id');
            
            if (!token || !userId || !sessionId) {
                navigate('/', { replace: true });
                return;
            }
            
            setCurrentUserId(userId);
            
            const savedGuildId = await storeAPI.get<number>('current_guild_id');
            if (savedGuildId) {
                setCurrentGuildId(savedGuildId);
            }
            
            const savedRoomId = await storeAPI.get<number>('current_room_id');
            if (savedRoomId) {
                setCurrentRoomId(savedRoomId);
            }
            
            setIsLoading(false);
        };
        
        loadUserData();
        
        // Следим за состоянием подключения WebSocket
        const unsubscribe = wsService.onConnectionChange((connected) => {
            setIsConnected(connected);
        });
        
        setIsConnected(wsService.getConnectionStatus());
        
        return () => {
            unsubscribe();
        };
    }, [navigate]);

    const handleGuildSelect = useCallback(async (guildId: number) => {
        console.log(`🔄 Switching to guild: ${guildId}`);
        setCurrentGuildId(guildId);
        await storeAPI.set('current_guild_id', guildId);
        setCurrentRoomId(undefined);
        await storeAPI.delete('current_room_id');
    }, []);

    const handleRoomSelect = useCallback(async (roomId: number) => {
        setCurrentRoomId(roomId);
        await storeAPI.set('current_room_id', roomId);
    }, []);

    if (isLoading) {
        return <div className="loading-container">Загрузка...</div>;
    }

    if (!currentGuildId) {
        return (
            <div className="main-page-container">
                <div className="connection-status">
                    {!isConnected && <span className="disconnected">🔄 Подключение к серверу...</span>}
                </div>
                <div className="main-container">
                    <div className="welcome-placeholder">
                        <h2>Добро пожаловать!</h2>
                        <p>Выберите канал слева</p>
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
            <div className="connection-status">
                {!isConnected && <span className="disconnected">🔄 Переподключение...</span>}
            </div>
            
            <div className="main-container">
                {currentRoomId ? (
                    <Messenger_Field 
                        key={`messenger-${currentGuildId}-${currentRoomId}`}
                        roomId={currentRoomId} 
                        currentUserId={currentUserId}
                    />
                ) : (
                    <div className="messenger-field">
                        <div className="room-selection-placeholder">
                            <h2>Выберите комнату</h2>
                            <p>Выберите текстовую комнату из списка справа</p>
                        </div>
                    </div>
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