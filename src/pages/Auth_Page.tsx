//
// Cтраница авторизации
//

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

import "./Auth_Page.css"

const setAuth = () => {
    localStorage.setItem('token', "true");
}

export function Auth_Page() {
    const navigate = useNavigate();
    const [loginValue, setLoginValue] = useState("");
    const [passwordValue, setPassValue] = useState("");

    const handleLoginChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLoginValue(event.target.value);
    }

    const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPassValue(event.target.value);
    }

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            navigate('/main', { replace: true });
        }
    }, [navigate]);
    
    const handleLogin = async () => {
        const result = await invoke("login", { login: loginValue, password: passwordValue });
        console.log("Результат:", result);
        
        if (result === true) {
            setAuth()
            navigate('/main', { replace: true });
        } 
        else
            console.log("Неверный логин или пароль");
    };

    const handleRegister = () => {
        navigate('/register_page', { replace: true });
    };

    return (
        <div className="auth-page-container">
            <p className="auth-greet">Приветствуем Вас!</p>

            <div className="auth-form">
                <input className="login" placeholder="Логин" onChange={handleLoginChange} value={loginValue}></input>
                <input className="password" placeholder="Пароль" onChange={handlePasswordChange} value={passwordValue}></input>

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