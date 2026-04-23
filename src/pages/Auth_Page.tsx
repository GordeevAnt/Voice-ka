import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

import "./Auth_Page.css"

//
// Cтраница авторизации
//

const setAuth = (userId: number, sessionId: string) => {
    localStorage.setItem('token', "true");
    localStorage.setItem('user_id', userId.toString());
    localStorage.setItem('session_id', sessionId);
}

function WrongData() {
    return <div className="wrong-active">Неверные данные</div>
}

export function Auth_Page() {
    const navigate = useNavigate();
    const [loginValue, setLoginValue] = useState("");
    const [passwordValue, setPassValue] = useState("");
    const [wrong, setWrong] = useState(0)

    const handleLoginChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLoginValue(event.target.value);
    }

    const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPassValue(event.target.value);
    }
    
    const handleLogin = async () => {
        try {
            const result = await invoke("login", { login: loginValue, password: passwordValue });
            
            // result теперь кортеж [success, user_id, session_id]
            if (result && Array.isArray(result) && result[0] === true) {
                const success = result[0];
                const userId = result[1];
                const sessionId = result[2];
                
                if (success) {
                    setAuth(userId, sessionId);
                    navigate('/main', { replace: true });
                } else {
                    setLoginValue("");
                    setPassValue("");
                    setWrong(1);
                }
            } else {
                setLoginValue("");
                setPassValue("");
                setWrong(1);
            }
        } catch (error) {
            console.error("Ошибка входа:", error);
            setLoginValue("");
            setPassValue("");
            setWrong(1);
        }
    };

    const handleRegister = () => {
        navigate('/register_page', { replace: true });
    };

    return (
        <div className="auth-page-container">
            <p className="auth-greet">Приветствуем Вас!</p>
            <div className="auth-form">
                {wrong === 1 && <WrongData />}
                <input className="login" placeholder="Логин" onChange={handleLoginChange} value={loginValue}></input>
                <input className="password" placeholder="Пароль" onChange={handlePasswordChange} value={passwordValue}></input>

                {/* <div className="lost-password-btn-container">
                    <button>Забыли пароль</button>
                </div> */}
                
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