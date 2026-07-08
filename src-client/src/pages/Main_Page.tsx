// Main_Page.tsx
import { Messenger_Field } from "../widgets/Messenger_Field"
import Info_Chanel_Button from "../shared/Info_Chanel_Button"
import Info_Room_Button from "../shared/Info_Room_Button"
import Info_Personal_Account_Button from "../shared/Info_Personal_Account_Button"
import { Rooms_Online_List } from "../widgets/Rooms_Online_List"
import { Rooms_List } from "../widgets/Rooms_List"

import "./Main_Page.css"
import { Chanels_List } from "../widgets/Chanels_List"
import { Logout } from "../features/auth/Logout"
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { storeAPI } from "../features/useStore"
import { wsService } from "../features/websocket.service"

export function Main_Page() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [currentGuildId, setCurrentGuildId] = useState<number | null>(null);
    const [currentRoomId, setCurrentRoomId] = useState<number | undefined>(undefined);
    const [currentRoomName, setCurrentRoomName] = useState<string>('');
    const [currentRoomType, setCurrentRoomType] = useState<string>('text');
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
                // Загружаем имя комнаты
                const roomName = await storeAPI.get<string>('current_room_name');
                const roomType = await storeAPI.get<string>('current_room_type');
                if (roomName) {
                    setCurrentRoomName(roomName);
                    setCurrentRoomType(roomType || 'text');
                }
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

    useEffect(() => {
        if (currentGuildId) {
            console.log('📡 Main_Page subscribing to guild:', currentGuildId);
            wsService.subscribeGuild(currentGuildId);
            
            return () => {
                console.log('📡 Main_Page unsubscribing from guild:', currentGuildId);
                wsService.unsubscribeGuild(currentGuildId);
            };
        }
    }, [currentGuildId]);

    // В Main_Page.tsx добавьте подписку на обновления комнаты и гильдии

useEffect(() => {
    // Подписываемся на обновление гильдии
    const unsubscribeGuildUpdated = wsService.on('guild_updated', async (updatedGuild) => {
        if (updatedGuild.id === currentGuildId) {
            // Обновляем название гильдии в состоянии
            await storeAPI.set('current_guild_name', updatedGuild.name);
            await storeAPI.set('current_guild_icon', updatedGuild.icon || null);
            console.log('✅ Updated guild data in store:', updatedGuild.name);
        }
    });

    // Подписываемся на обновление комнаты
    const unsubscribeRoomUpdated = wsService.on('room_updated', async (updatedRoom) => {
            if (updatedRoom.id === currentRoomId) {
                // Обновляем название комнаты в состоянии
                setCurrentRoomName(updatedRoom.name);
                setCurrentRoomType(updatedRoom.type || 'text');
                await storeAPI.set('current_room_name', updatedRoom.name);
                await storeAPI.set('current_room_type', updatedRoom.type || 'text');
                console.log('✅ Updated room data in store:', updatedRoom.name);
            }
        });

        return () => {
            unsubscribeGuildUpdated();
            unsubscribeRoomUpdated();
        };
    }, [currentGuildId, currentRoomId]);

    const handleGuildSelect = useCallback(async (guildId: number) => {
        console.log(`🔄 Switching to guild: ${guildId}`);
        setCurrentGuildId(guildId);
        await storeAPI.set('current_guild_id', guildId);
        setCurrentRoomId(undefined);
        setCurrentRoomName('');
        setCurrentRoomType('text');
        await storeAPI.delete('current_room_id');
        await storeAPI.delete('current_room_name');
        await storeAPI.delete('current_room_type');
        
        wsService.notify('guild_switched', { guild_id: guildId });
    }, []);

    const handleRoomSelect = useCallback(async (roomId: number) => {
        setCurrentRoomId(roomId);
        await storeAPI.set('current_room_id', roomId);
        
        // Получаем имя комнаты из списка
        try {
            const rooms = await storeAPI.get<any[]>('guild_rooms');
            if (rooms) {
                const room = rooms.find(r => r.id === roomId);
                if (room) {
                    setCurrentRoomName(room.name);
                    setCurrentRoomType(room.type || 'text');
                    await storeAPI.set('current_room_name', room.name);
                    await storeAPI.set('current_room_type', room.type || 'text');
                    console.log('✅ Saved room data:', room.name);
                }
            }
        } catch (error) {
            console.error('Error saving room data:', error);
        }
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
                        <p>Выберите канал внизу</p>
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
                        <Info_Chanel_Button key={`chanel-${currentGuildId}`} />
                        <Info_Room_Button 
                            key={`room-${currentRoomId || 'none'}`}
                            roomName={currentRoomName}
                            roomType={currentRoomType}
                            isActive={!!currentRoomId}
                        />
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