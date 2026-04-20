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
import { useState } from "react"

//
// Главная страница
//

export function Main_Page() {
    const [currentGuildId, setCurrentGuildId] = useState<number | null>(() => {
        // Загружаем сохраненный канал из localStorage
        const savedGuildId = localStorage.getItem('current_guild_id');
        return savedGuildId ? parseInt(savedGuildId) : null;
    });
    const [currentRoomId, setCurrentRoomId] = useState<number | undefined>(() => {
        const savedRoomId = localStorage.getItem('current_room_id');
        return savedRoomId ? parseInt(savedRoomId) : undefined;
    });

    const handleGuildSelect = (guildId: number) => {
        setCurrentGuildId(guildId);
        localStorage.setItem('current_guild_id', guildId.toString());
        // Сбрасываем выбранную комнату при смене канала
        setCurrentRoomId(undefined);
        localStorage.removeItem('current_room_id');
    };

    // const handleRoomSelect = (roomId: number) => {
    //     setCurrentRoomId(roomId);
    //     localStorage.setItem('current_room_id', roomId.toString());
    // };

    // Если нет выбранного канала (guild) или нет пользователя
    if (currentGuildId === -1) {
        return (
            <div className="main-page-container">
                <div className="main-container"></div>
                <Chanels_List 
                    currentGuildId={currentGuildId}
                    onGuildSelect={handleGuildSelect}
                />
            </div>
        )
    }

    return (
        <div className="main-page-container">
            
            <div className="main-container">

                <Messenger_Field />

                <div className="room-container">
                    
                    <div className="settings">
                        <Info_Chanel_Button />
                        <Info_Room_Button />
                        <Info_Personal_Account_Button />
                        <Logout />
                    </div>
                    
                    <div className="room-selector">
                        <Rooms_Online_List />
                        <Rooms_List 
                            guildId={currentGuildId as number}
                            currentRoomId={currentRoomId}
                            onRoomSelect={setCurrentRoomId}
                        />
                    </div>
                
                </div>

            </div>

            <Chanels_List 
                currentGuildId={currentGuildId as number}
                onGuildSelect={handleGuildSelect}
            />
        
        </div>
    )
}