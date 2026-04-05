//
// Компонент для отображения маршрута
// авторизованным пользователям
//

import { Navigate, Outlet } from 'react-router-dom';

export function Logined_Layout() {
  const isAuthenticated = localStorage.getItem('token');
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
};