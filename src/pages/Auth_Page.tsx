import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { storeAPI } from "../features/useStore";

import "./Auth_Page.css"

const setAuth = async (userId: number, sessionId: string) => {
    await storeAPI.set('token', "true");
    await storeAPI.set('user_id', userId.toString());
    await storeAPI.set('session_id', sessionId);
    
    console.log('Auth data saved:', { userId, sessionId });
}

function WrongData() {
    return <div className="wrong-active">Неверные данные</div>
}

export function Auth_Page() {
    const navigate = useNavigate();
    const [loginValue, setLoginValue] = useState("");
    const [passwordValue, setPassValue] = useState("");
    const [wrong, setWrong] = useState(0);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // Проверяем, не авторизован ли уже пользователь
    useEffect(() => {
        const checkAuth = async () => {
            const token = await storeAPI.get('token');
            const userId = await storeAPI.get('user_id');
            
            if (token && userId) {
                console.log('User already authenticated, redirecting...');
                navigate('/main', { replace: true });
            }
            setIsCheckingAuth(false);
        };
        checkAuth();
    }, [navigate]);

    const handleLoginChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLoginValue(event.target.value);
    }

    const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPassValue(event.target.value);
    }
    
    const handleLogin = async () => {
        try {
            console.log('Attempting login with:', loginValue);
            const result = await invoke("login", { login: loginValue, password: passwordValue });
            
            console.log('Login result:', result);
            
            if (result && Array.isArray(result) && result[0] === true) {
                const success = result[0];
                const userId = result[1];
                const sessionId = result[2];
                
                console.log('Saving session:', { userId, sessionId }); // Добавьте это
                
                if (success) {
                    await setAuth(userId, sessionId);
                    
                    // Проверяем, что данные сохранились
                    const verifyUserId = await storeAPI.get('user_id');
                    const verifySessionId = await storeAPI.get('session_id');
                    console.log('Verification - stored:', { 
                        user_id: verifyUserId, 
                        session_id: verifySessionId 
                    });
                    
                    // Проверяем текущего пользователя
                    const currentUser = await invoke("get_current_user", { 
                        sessionId: verifySessionId 
                    });
                    console.log('Current user:', currentUser);
                    
                    navigate('/main', { replace: true });
                }
            }
        } catch (error) {
            console.error("Ошибка входа:", error);
        }
    };

    const handleRegister = () => {
        navigate('/register_page', { replace: true });
    };

    if (isCheckingAuth) {
        return <div className="loading-container">Проверка авторизации...</div>;
    }

    return (
        <div className="auth-page-container">
            <p className="auth-greet">Приветствуем Вас!</p>
            <div className="auth-form">
                {wrong === 1 && <WrongData />}
                <input 
                    className="login" 
                    placeholder="Логин" 
                    onChange={handleLoginChange} 
                    value={loginValue}
                />
                <input 
                    className="password" 
                    placeholder="Пароль" 
                    type="password"
                    onChange={handlePasswordChange} 
                    value={passwordValue}
                />

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