// Auth_Page.tsx - исправленная версия
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { storeAPI } from "../features/useStore";

import "./Auth_Page.css"

const setAuth = async (userId: number, sessionId: string) => {
    try {
        await storeAPI.set('token', "true");
        await storeAPI.set('user_id', userId.toString());
        await storeAPI.set('session_id', sessionId);
        
        // Проверяем, что данные сохранились
        const savedToken = await storeAPI.get('token');
        const savedUserId = await storeAPI.get('user_id');
        const savedSessionId = await storeAPI.get('session_id');
        
        console.log('Auth data saved successfully:', { 
            userId: savedUserId, 
            sessionId: savedSessionId,
            token: savedToken 
        });
    } catch (error) {
        console.error('Failed to save auth data:', error);
        throw error;
    }
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
            try {
                const token = await storeAPI.get('token');
                const userId = await storeAPI.get('user_id');
                
                console.log('Checking existing auth:', { token, userId });
                
                if (token && userId) {
                    console.log('User already authenticated, redirecting...');
                    navigate('/main', { replace: true });
                }
            } catch (error) {
                console.error('Error checking auth:', error);
            } finally {
                setIsCheckingAuth(false);
            }
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
            setWrong(0);
            console.log('🔑 Attempting login with:', loginValue);
            
            const result = await invoke("login", { 
                login: loginValue, 
                password: passwordValue,
                ipAddress: null,
                userAgent: navigator.userAgent
            });
            
            console.log('📥 Raw result:', result);
            console.log('📥 Result type:', typeof result);
            
            // Tauri возвращает кортеж как массив
            if (Array.isArray(result) && result.length >= 3) {
                const [success, userId, sessionId] = result;
                
                console.log('📊 Parsed result:', { success, userId, sessionId });
                
                if (success === true && userId > 0 && sessionId) {
                    console.log('✅ Login successful, saving auth data...');
                    await setAuth(userId, sessionId);
                    console.log('🚀 Redirecting to main page...');
                    navigate('/main', { replace: true });
                } else {
                    console.log('❌ Login failed: invalid credentials');
                    setWrong(1);
                }
            } else {
                console.error('❌ Unexpected result format:', result);
                setWrong(1);
            }
        } catch (error) {
            console.error("❌ Login error:", error);
            setWrong(1);
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