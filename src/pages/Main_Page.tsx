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
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

//
// Главная страница
//

interface User {
    id: number;
    username: string;
    email: string;
}

export function Main_Page() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentGuildId, setCurrentGuildId] = useState<number>(1);
    const [currentRoomId, setCurrentRoomId] = useState<number | undefined>();

    // Загружаем данные пользователя
    useEffect(() => {
        const loadUser = async () => {
            try {
                // Попробуйте получить текущего пользователя
                // Если такой команды нет, можно получить из localStorage или использовать заглушку
                const currentUser = await invoke<User>("get_current_user").catch(() => {
                    // Если команды нет, используем заглушку для тестирования
                    console.warn("get_current_user not implemented, using mock user");
                    return { id: 1, username: "test_user", email: "test@example.com" };
                });
                setUser(currentUser);
            } catch (error) {
                console.error("Failed to load user:", error);
                // Используем тестового пользователя для разработки
                setUser({ id: 1, username: "dev_user", email: "dev@example.com" });
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, []);

    // Показываем загрузку, пока данные не получены
    if (loading) {
        return (
            <div className="main-page-container">
                <div className="loading-screen">Загрузка...</div>
            </div>
        );
    }

    // Если пользователь не авторизован, показываем ошибку
    if (!user) {
        return (
            <div className="main-page-container">
                <div className="error-screen">Ошибка авторизации</div>
            </div>
        );
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
                        {user && user.id && (
                            <Rooms_List 
                                guildId={currentGuildId}
                                userId={user.id}
                                currentRoomId={currentRoomId}
                                onRoomSelect={setCurrentRoomId}
                            />
                        )}
                    </div>
                
                </div>

            </div>

            <Chanels_List />
        
        </div>
    )
}