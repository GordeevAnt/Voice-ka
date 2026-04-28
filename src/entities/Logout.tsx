// Logout.tsx - с правильной очисткой и уведомлением
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { storeAPI } from "../features/useStore";

export function Logout() {
    const navigate = useNavigate();
    
    const handleLogout = async () => {
        try {
            const userId = await storeAPI.get('user_id');
            const sessionId = await storeAPI.get('session_id');
            
            console.log('Logout: User data', { userId, sessionId });
            
            if (userId) {
                // Вызываем logout с WebSocket менеджером
                const result = await invoke('logout', { 
                    userId: parseInt(userId as string),
                    sessionId: sessionId || null
                });
                
                console.log('Logout result:', result);
            }
            
            // Очищаем хранилище
            await storeAPI.clear();
            
            // Небольшая задержка для завершения WebSocket операций
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Перенаправляем на страницу входа
            navigate('/', { replace: true });
            
        } catch (error) {
            console.error("Ошибка при выходе:", error);
            // В случае ошибки все равно очищаем и перенаправляем
            await storeAPI.clear();
            navigate('/', { replace: true });
        }
    };
    
    return (
        <button onClick={handleLogout} className="logout-btn">
            Выйти
        </button>
    );
}