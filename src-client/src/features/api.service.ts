// src/features/api.service.ts
import { wsService } from './websocket.service';
import { storeAPI } from './useStore';

class ApiService {
    async login(login: string, password: string, ipAddress: string | null, userAgent: string): Promise<[boolean, number, string]> {
        try {
            console.log('Sending login request...');
            
            // Отправляем запрос на логин через существующее WebSocket соединение
            const result = await wsService.request('login', { 
                login, 
                password, 
                ip_address: ipAddress, 
                user_agent: userAgent 
            });
            
            console.log('Login result:', result);
            
            if (result.success && result.user_id && result.session_token) {
                // Аутентифицируемся на существующем соединении (без переподключения!)
                await wsService.authenticate(result.session_token, result.user_id);
                
                return [true, result.user_id, result.session_token];
            }
            return [false, 0, ''];
        } catch (err) {
            console.error('Login error:', err);
            return [false, 0, ''];
        }
    }

    async register(login: string, email: string, password: string, confirmPassword: string): Promise<[boolean, number]> {
        try {
            const result = await wsService.request('register', { 
                login, 
                email, 
                password, 
                confirm_password: confirmPassword 
            });
            
            if (result.success && result.user_id) {
                return [true, result.user_id];
            }
            return [false, 0];
        } catch (err) {
            console.error('Register error:', err);
            return [false, 0];
        }
    }

    async logout(userId: number, sessionToken: string | null): Promise<boolean> {
        try {
            const result = await wsService.request('logout', { user_id: userId });
            
            // Очищаем данные аутентификации
            await storeAPI.clear();
            wsService.disconnect();
            
            return result.success === true;
        } catch (err) {
            console.error('Logout error:', err);
            return false;
        }
    }

    // ... остальные методы без изменений
}

export const apiService = new ApiService();