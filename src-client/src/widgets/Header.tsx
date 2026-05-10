import { getCurrentWindow } from "@tauri-apps/api/window"
import { useState, useEffect } from "react"
import { apiService } from "../features/api.service"
import { storeAPI } from "../features/useStore"

import "./Header.css"

//
// Хедер (шапка окна)
//

export function Header() {
    const appWindow = getCurrentWindow();
    const [isMaximized, setIsMaximized] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        // Проверяем текущее состояние окна при загрузке
        const checkMaximized = async () => {
            const maximized = await appWindow.isMaximized();
            setIsMaximized(maximized);
        };
        
        checkMaximized();

        // Подписываемся на события изменения размера окна
        const unlistenResized = appWindow.onResized(() => {
            checkMaximized();
        });

        // Также подписываемся на событие moved (некоторые платформы)
        const unlistenMoved = appWindow.onMoved(() => {
            checkMaximized();
        });

        return () => {
            unlistenResized.then(unlisten => unlisten());
            unlistenMoved.then(unlisten => unlisten());
        };
    }, [appWindow]);

    const handleToggleMaximize = async () => {
        await appWindow.toggleMaximize();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
    };

    const handleClose = async () => {
        if (isLoggingOut) return; // Предотвращаем повторные вызовы
        
        setIsLoggingOut(true);
        
        try {
            // Получаем данные пользователя
            const userId = await storeAPI.get<number>('user_id');
            const sessionId = await storeAPI.get<string>('session_id');
            
            console.log('Closing app: Logging out user', { userId, sessionId });
            
            // Выполняем выход, если пользователь авторизован
            if (userId) {
                await apiService.logout(userId, sessionId || null);
            } else {
                // Если нет данных о пользователе, просто очищаем хранилище
                await storeAPI.clear();
            }
            
            // Небольшая задержка для завершения WebSocket операций
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.error("Error during logout on app close:", error);
            // В случае ошибки все равно очищаем хранилище
            try {
                await storeAPI.clear();
            } catch (clearError) {
                console.error("Error clearing store:", clearError);
            }
        } finally {
            // Закрываем окно после завершения операций выхода
            await appWindow.close();
        }
    };

    return (
        <div className="titlebar" data-tauri-drag-region>
            
            <div className="titlebar-title">
                <img src="/voice-ka.svg" alt="Voice-ka" />
            </div>
            
            <div className="titlebar-title-name">
                <h4>Voice-ka</h4>
            </div>

            <div className="titlebar-controls">
                
                <button className="titlebar-btn" id="titlebar-minimize" onClick={() => appWindow.minimize()}>
                    –
                </button>
                
                <button 
                    className="titlebar-btn" 
                    id="titlebar-switch-window-size" 
                    onClick={handleToggleMaximize}
                >
                    <img 
                        src={isMaximized ? "/minimize.svg" : "/maximize.svg"} 
                        alt={isMaximized ? "Restore" : "Maximize"}
                    />
                </button>
                
                <button 
                    className="titlebar-btn close" 
                    id="titlebar-close" 
                    onClick={handleClose}
                    disabled={isLoggingOut}
                >
                    <img src="/close.svg" alt="Close" />
                </button>
            
            </div>
        
        </div>
    )
}