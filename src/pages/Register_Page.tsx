import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import "./Register_Page.css"

//
// Cтраница регистрации
//

function WrongData() {
    return <div className="wrong-active">Неверные данные</div>
}

export function Register_Page() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [wrong, setWrong] = useState(0)
    const [errorMessage, setErrorMessage] = useState('');
    
    const handleBack = () => {
        navigate('/', { replace: true });
    }

    const handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setUsername(event.target.value);
    }

    const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(event.target.value);
    }

    const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(event.target.value);
    }

    const handleConfPasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setConfirmPassword(event.target.value);
    }

    const handleRegister = async () => {
        try {
            const result = await invoke('register', { 
                login: username,  // Важно: в Rust функция ожидает параметр "login"
                email, 
                password, 
                confirmPassword 
            });
            
            // result возвращает кортеж [success, user_id]
            if (result && Array.isArray(result) && result[0] === true) {
                const userId = result[1];
                localStorage.setItem('token', "true");
                localStorage.setItem('user_id', userId.toString());
                navigate('/main', { replace: true });
            } else {
                setUsername("");
                setEmail("");
                setPassword("");
                setConfirmPassword("");
                setWrong(1);
                setErrorMessage("Ошибка регистрации");
            }
        } catch (err) {
            setErrorMessage(err as string);
            setUsername("");
            setEmail("");
            setPassword("");
            setConfirmPassword("");
            setWrong(1);
            console.error("Ошибка регистрации:", err);
        }
    };
    
    return (
        <div className="register-page-container">
            <div className="back-btn-container">
                <button className="back-btn" onClick={handleBack}>Назад</button>
            </div>
            <p className="reg-greet">Приветствуем Вас!</p>
            <div className="register-form">
                {wrong === 1 && <WrongData />}
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <input 
                    className="username" 
                    placeholder="Имя"
                    value={username}
                    onChange={handleUsernameChange}
                />
                <input 
                    className="email" 
                    placeholder="Почта"
                    value={email}
                    onChange={handleEmailChange}
                />
                <input 
                    className="first-password" 
                    placeholder="Пароль"
                    type="password"
                    value={password}
                    onChange={handlePasswordChange}
                />
                <input 
                    className="second-password" 
                    placeholder="Подтвердите пароль"
                    type="password"
                    value={confirmPassword}
                    onChange={handleConfPasswordChange}
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