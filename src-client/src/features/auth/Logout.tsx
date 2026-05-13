// Logout.tsx
import { useNavigate } from "react-router-dom";
import { storeAPI } from "../features/useStore";
import { apiService } from "../features/api.service";

export function Logout() {
    const navigate = useNavigate();
    
    const handleLogout = async () => {
        try {
            const userId = await storeAPI.get<number>('user_id');
            const sessionId = await storeAPI.get<string>('session_id');
            
            console.log('Logout: User data', { userId, sessionId });
            
            if (userId) {
                await apiService.logout(userId, sessionId || null);
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