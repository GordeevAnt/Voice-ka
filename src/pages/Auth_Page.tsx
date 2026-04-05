//
// Cтраница авторизации
//

import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

import "./Auth_Page.css"

const setAuth = () => {
    localStorage.setItem('token', "true");
}

export function Auth_Page() {
    const navigate = useNavigate();
    
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            navigate('/main', { replace: true });
        }
    }, [navigate]);
    
    const handleLogin = () => {
        setAuth();
        navigate('/main', { replace: true });
    };

    const handleRegister = () => {
        navigate('/register_page', { replace: true });
    };

    return (
        <div className="auth-page-container">
            <p className="auth-greet">Приветствуем Вас!</p>
            <div className="auth-form">
                <input className="login" placeholder="Логин"></input>
                <input className="password" placeholder="Пароль"></input>
                <div className="lost-password-btn-container">
                    <button>Забыли пароль</button>
                </div>
                <div className="auth-buttons">
                    <button className="auth-form-btn auth" onClick={handleLogin}>
                        Войти
                    </button>

                    <button className="auth-form-btn reg" onClick={handleRegister}>
                        Зарегистрироваться
                    </button>
                </div>
            </div>
        </div>
    )
}