import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

//
// Кнопка выхода из аккаунта
//

export function Logout() {
    const navigate = useNavigate();
    
    const handleLogout = async () => {
        try {
            const userId = localStorage.getItem('user_id');
            const sessionId = localStorage.getItem('session_id');
            
            if (userId) {
                const result = await invoke('logout', { 
                    userId: parseInt(userId),
                    sessionId: sessionId || null
                });
                
                if (result === true) {
                    // Очищаем localStorage
                    localStorage.removeItem('token');
                    localStorage.removeItem('user_id');
                    localStorage.removeItem('session_id');
                    localStorage.removeItem('username');
                    
                    // Перенаправляем на страницу входа
                    navigate('/', { replace: true });
                }
            } else {
                // Если нет user_id, просто очищаем и перенаправляем
                localStorage.clear();
                navigate('/', { replace: true });
            }
        } catch (error) {
            console.error("Ошибка при выходе:", error);
            // Даже при ошибке пробуем очистить и перенаправить
            localStorage.clear();
            navigate('/', { replace: true });
        }
    };
    
    return (
        <button onClick={handleLogout} className="logout-btn">
            Выйти
        </button>
    );
}