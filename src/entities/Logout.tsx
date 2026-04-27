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
                const result = await invoke('logout', { 
                    userId: parseInt(userId as string),
                    sessionId: sessionId || null
                });
                
                if (result === true) {
                    await storeAPI.clear();
                    navigate('/', { replace: true });
                }
            } else {
                await storeAPI.clear();
                navigate('/', { replace: true });
            }
        } catch (error) {
            console.error("Ошибка при выходе:", error);
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