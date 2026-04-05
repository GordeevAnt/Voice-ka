//
// Cтраница регистрации
//

import { useNavigate } from "react-router-dom";
import { useState } from "react";

import "./Register_Page.css"

export function Register_Page() {
    const navigate = useNavigate();
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    
    const handleBack = () => {
        navigate('/', { replace: true });
    }

    const handleRegister = () => {
        localStorage.setItem('token', "true");
        navigate('/main', { replace: true });
    };
    
    return (
        <div className="register-page-container">
            <div className="back-btn-container">
                <button className="back-btn" onClick={handleBack}>Назад</button>
            </div>
            <p className="reg-greet">Приветствуем Вас!</p>
            <div className="register-form">
                <input 
                    className="login" 
                    placeholder="Логин"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                />
                <input 
                    className="first-password" 
                    placeholder="Пароль"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <input 
                    className="second-password" 
                    placeholder="Пароль"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                    className="reg-form-btn-submit"
                    onClick={handleRegister}
                >
                    Подтвердить
                </button>
            </div>
        </div>
    )
}