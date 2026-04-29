// Register_Page.tsx - исправленная версия
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./Register_Page.css";
import { storeAPI } from "../features/useStore";

export function Register_Page() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const handleBack = () => {
        navigate('/', { replace: true });
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        // Клиентская валидация
        if (password !== confirmPassword) {
            setErrorMessage("Пароли не совпадают");
            return;
        }
        
        if (password.length < 6) {
            setErrorMessage("Пароль должен быть минимум 6 символов");
            return;
        }
        
        if (username.length < 3) {
            setErrorMessage("Имя должно быть минимум 3 символа");
            return;
        }
        
        if (!email.includes('@') || !email.includes('.')) {
            setErrorMessage("Некорректный email");
            return;
        }
        
        setIsLoading(true);
        setErrorMessage('');
        
        try {
            console.log('🔑 Attempting registration with:', { username, email });
            
            const result = await invoke('register', { 
                login: username,
                email, 
                password, 
                confirmPassword 
            });
            
            console.log('📥 Registration result:', result);
            
            if (Array.isArray(result) && result.length >= 2) {
                const [success, userId] = result;
                
                if (success === true && userId > 0) {
                    console.log('✅ Registration successful, performing auto-login...');
                    
                    // После регистрации выполняем вход
                    const loginResult = await invoke('login', { 
                        login: username, 
                        password: password,
                        ipAddress: null,
                        userAgent: navigator.userAgent
                    });
                    
                    console.log('📥 Login result:', loginResult);
                    
                    if (Array.isArray(loginResult) && loginResult.length >= 3) {
                        const [loginSuccess, loginUserId, sessionId] = loginResult;
                        
                        if (loginSuccess === true && sessionId) {
                            // Сохраняем все данные
                            await storeAPI.set('token', "true");
                            await storeAPI.set('user_id', loginUserId.toString());
                            await storeAPI.set('session_id', sessionId);
                            
                            // Проверяем сохранение
                            const savedToken = await storeAPI.get('token');
                            const savedUserId = await storeAPI.get('user_id');
                            const savedSessionId = await storeAPI.get('session_id');
                            
                            console.log('✅ Auth data saved:', { 
                                token: savedToken,
                                userId: savedUserId, 
                                sessionId: savedSessionId 
                            });
                            
                            navigate('/main', { replace: true });
                        } else {
                            setErrorMessage("Ошибка входа после регистрации");
                        }
                    } else {
                        // Если логин не сработал, все равно пробуем перейти
                        console.warn('⚠️ Auto-login failed, redirecting to login page');
                        await storeAPI.set('token', "true");
                        await storeAPI.set('user_id', userId.toString());
                        navigate('/main', { replace: true });
                    }
                } else {
                    setErrorMessage("Ошибка регистрации. Попробуйте другие данные.");
                }
            } else {
                setErrorMessage("Ошибка регистрации. Неверный формат ответа.");
            }
        } catch (err: any) {
            console.error("❌ Registration error:", err);
            setErrorMessage(typeof err === 'string' ? err : "Произошла ошибка при регистрации");
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };
    
    return (
        <div className="register-page-container">
            <div className="back-btn-container">
                <button className="back-btn" onClick={handleBack} type="button" disabled={isLoading}>
                    Назад
                </button>
            </div>
            <p className="reg-greet">Приветствуем Вас!</p>
            <form className="register-form" onSubmit={handleSubmit}>
                {errorMessage && (
                    <div className="error-message" role="alert">
                        {errorMessage}
                    </div>
                )}
                
                <input 
                    className="username" 
                    placeholder="Имя"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    minLength={3}
                    required
                    autoComplete="username"
                />
                <input 
                    className="email" 
                    placeholder="Почта"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    required
                    autoComplete="email"
                />
                <input 
                    className="first-password" 
                    placeholder="Пароль"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    minLength={6}
                    required
                    autoComplete="new-password"
                />
                <input 
                    className="second-password" 
                    placeholder="Подтвердите пароль"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    minLength={6}
                    required
                    autoComplete="new-password"
                />
                <button 
                    className={`reg-form-btn-submit ${isLoading ? 'loading' : ''}`}
                    type="submit"
                    disabled={isLoading}
                >
                    {isLoading ? 'Регистрация...' : 'Подтвердить'}
                </button>
            </form>
        </div>
    );
}