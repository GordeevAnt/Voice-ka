//
// Компонент для отображения маршрута
// авторизованным пользователям
//

import { Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { storeAPI } from '../features/useStore';

export function Logined_Layout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkAuth = async () => {
      const token = await storeAPI.get('token');
      setIsAuthenticated(!!token);
    };
    checkAuth();
  }, []);
  
  if (isAuthenticated === null) {
    return <div>Проверка авторизации...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
};