// Logined_Layout.tsx - исправленная версия
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { storeAPI } from '../features/useStore';

export function Logined_Layout() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [isChecking, setIsChecking] = useState(true);
    const location = useLocation();
    const checkCountRef = useRef(0);
    
    useEffect(() => {
        let isMounted = true;
        
        const checkAuth = async () => {
            // Предотвращаем множественные проверки
            if (checkCountRef.current > 2) {
                console.warn('Слишком много проверок авторизации');
                return;
            }
            checkCountRef.current++;
            
            try {
                setIsChecking(true);
                
                // Добавляем небольшую задержку для стабилизации состояния
                if (checkCountRef.current === 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                const token = await storeAPI.get('token');
                
                if (isMounted) {
                    setIsAuthenticated(!!token);
                }
            } catch (error) {
                console.error('Ошибка проверки авторизации:', error);
                if (isMounted) {
                    setIsAuthenticated(false);
                }
            } finally {
                if (isMounted) {
                    setIsChecking(false);
                }
            }
        };
        
        checkAuth();
        
        return () => {
            isMounted = false;
        };
    }, [location.pathname]); // Перепроверяем при изменении пути
    
    // Показываем загрузку только при реальной проверке
    if (isChecking && isAuthenticated === null) {
        return (
            <div className="auth-check-container">
                <div className="auth-check-loading">
                    Проверка авторизации...
                </div>
            </div>
        );
    }
    
    // Если не авторизован - редирект
    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }
    
    // Если авторизован - показываем контент
    return <Outlet />;
};