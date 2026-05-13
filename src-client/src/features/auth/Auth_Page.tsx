// Auth_Page.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { storeAPI } from "../useStore";
import { apiService } from "../api.service";
import { wsService } from "../websocket.service";

import "./Auth_Page.css"

export function Auth_Page() {
    const navigate = useNavigate();
    const [loginValue, setLoginValue] = useState("");
    const [passwordValue, setPassValue] = useState("");
    const [wrong, setWrong] = useState(0);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = await storeAPI.get('token');
                const userId = await storeAPI.get('user_id');
                const sessionId = await storeAPI.get('session_id');
                
                console.log('Checking existing auth:', { token, userId, sessionId });
                
                if (token && userId && sessionId) {
                    // Ждем подключения WebSocket
                    if (!wsService.getConnectionStatus()) {
                        await new Promise<void>((resolve) => {
                            const unsubscribe = wsService.onConnectionChange((connected) => {
                                if (connected) {
                                    unsubscribe();
                                    resolve();
                                }
                            });
                        });
                    }
                    
                    // Аутентифицируемся на существующем соединении
                    await wsService.authenticate(sessionId as string, parseInt(userId as string));
                    
                    console.log('WebSocket authenticated, redirecting...');
                    navigate('/main', { replace: true });
                    return;
                }
            } catch (error) {
                console.error('Error checking auth:', error);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        
        // Даем WebSocket время на подключение
        setTimeout(() => {
            checkAuth();
        }, 500);
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
            setIsLoading(true);
            console.log('🔑 Attempting login with:', loginValue);
            
            // Ждем подключения WebSocket если его нет
            if (!wsService.getConnectionStatus()) {
                console.log('Waiting for WebSocket connection...');
                await new Promise<void>((resolve) => {
                    const unsubscribe = wsService.onConnectionChange((connected) => {
                        if (connected) {
                            unsubscribe();
                            resolve();
                        }
                    });
                });
            }
            
            const [success, userId, sessionId] = await apiService.login(
                loginValue, 
                passwordValue, 
                null, 
                navigator.userAgent
            );
            
            if (success) {
                console.log('✅ Login successful, redirecting...');
                navigate('/main', { replace: true });
            } else {
                console.log('❌ Login failed');
                setWrong(1);
                setIsLoading(false);
            }
        } catch (error) {
            console.error("❌ Login error:", error);
            setWrong(1);
            setIsLoading(false);
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
                {wrong === 1 && <div className="wrong-active">Неверные данные</div>}
                <input 
                    className="login" 
                    placeholder="Логин" 
                    onChange={handleLoginChange} 
                    value={loginValue}
                    disabled={isLoading}
                />
                <input 
                    className="password" 
                    placeholder="Пароль" 
                    type="password"
                    onChange={handlePasswordChange} 
                    value={passwordValue}
                    disabled={isLoading}
                />

                <div className="auth-buttons">
                    <button 
                        className="auth-form-btn auth" 
                        onClick={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? "Вход..." : "Войти"}
                    </button>

                    <button 
                        className="auth-form-btn reg" 
                        onClick={handleRegister}
                        disabled={isLoading}
                    >
                        Зарегистрироваться
                    </button>
                </div>
            </div>
        </div>
    )
}