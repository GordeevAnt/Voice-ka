//
// Кнопка выхода из аккаунта
//

import { useNavigate } from "react-router-dom";

export function Logout() {
    const navigate = useNavigate();
    
    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/', { replace: true });
    };

    return (
        <button onClick={handleLogout}>
            Выйти
        </button>
    )
}