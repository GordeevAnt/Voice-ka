// src/features/api.service.ts
import { wsService } from './websocket.service';
import { storeAPI } from './useStore';

class ApiService {
    async login(login: string, password: string, ipAddress: string | null, userAgent: string): Promise<[boolean, number, string]> {
        try {
            console.log('Sending login request...');
            
            // Ждем подключения WebSocket
            if (!wsService.getConnectionStatus()) {
                console.log('Waiting for WebSocket connection...');
                await new Promise<void>((resolve) => {
                    const unsubscribe = wsService.onConnectionChange((connected) => {
                        if (connected) {
                            unsubscribe();
                            resolve();
                        }
                    });
                    setTimeout(() => {
                        unsubscribe();
                        resolve();
                    }, 5000);
                });
            }
            
            const result = await wsService.request('login', { 
                login, 
                password, 
                ip_address: ipAddress, 
                user_agent: userAgent 
            });
            
            console.log('Login result:', result);
            
            if (result.success && result.user_id && result.session_token) {
                // Аутентифицируемся на существующем соединении
                await wsService.authenticate(result.session_token, result.user_id);
                
                // Ждем, пока аутентификация завершится
                await wsService.waitForAuth();
                
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
            
            return result.success === true;
        } catch (err) {
            console.error('Logout error:', err);
            return false;
        }
    }

    async getUserGuilds(userId: number): Promise<any[]> {
        try {
            console.log('Getting user guilds for userId:', userId);
            // Ждем аутентификации перед запросом
            await wsService.waitForAuth();
            
            const result = await wsService.request('get_user_guilds', { user_id: userId });
            console.log('Get user guilds result:', result);
            return result.guilds || [];
        } catch (err) {
            console.error('Get user guilds error:', err);
            return [];
        }
    }

    async getUserRolesInGuild(userId: number, guildId: number): Promise<any[]> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('get_user_roles_in_guild', { 
                user_id: userId, 
                guild_id: guildId 
            });
            return result.roles || [];
        } catch (err) {
            console.error('Get user roles error:', err);
            return [];
        }
    }

    async getUserPermissionsInGuild(userId: number, guildId: number): Promise<number> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('get_user_permissions_in_guild', { 
                user_id: userId, 
                guild_id: guildId 
            });
            return result.permissions || 0;
        } catch (err) {
            console.error('Get user permissions error:', err);
            return 0;
        }
    }

    async createGuild(guildData: any): Promise<any> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('create_guild', guildData);
            return result.guild;
        } catch (err) {
            console.error('Create guild error:', err);
            throw err;
        }
    }

    async updateGuild(guildId: number, data: { name: string; description?: string | null; icon?: string | null }): Promise<any> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('update_guild', data, { guild_id: guildId });
            return result.guild;
        } catch (err) {
            console.error('Update guild error:', err);
            throw err;
        }
    }

    async findGuildById(guildId: number): Promise<any | null> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('find_guild_by_id', { guild_id: guildId });
            return result.guild || null;
        } catch (err) {
            console.error('Find guild error:', err);
            return null;
        }
    }

    async joinGuild(userId: number, guildId: number): Promise<boolean> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('join_guild', { user_id: userId, guild_id: guildId });
            return result.success === true;
        } catch (err) {
            console.error('Join guild error:', err);
            return false;
        }
    }

    async getGuildMembers(guildId: number): Promise<any[]> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('get_guild_members', undefined, { guild_id: guildId });
            return result.members || [];
        } catch (err) {
            console.error('Get guild members error:', err);
            return [];
        }
    }

    async getOnlineGuildMembers(guildId: number): Promise<any[]> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('get_online_guild_members', undefined, { guild_id: guildId });
            return result.members || [];
        } catch (err) {
            console.error('Get online members error:', err);
            return [];
        }
    }

    async getGuildRooms(guildId: number): Promise<any[]> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('get_guild_rooms', undefined, { guild_id: guildId });
            return result.rooms || [];
        } catch (err) {
            console.error('Get guild rooms error:', err);
            return [];
        }
    }

    async createRoom(roomData: any): Promise<any> {
        try {
            console.log('📤 createRoom called with:', roomData);
            await wsService.waitForAuth();
            console.log('✅ Auth OK, sending request...');
            const result = await wsService.request('create_room', roomData);
            console.log('✅ createRoom result:', result);
            return result.room;
        } catch (err) {
            console.error('Create room error:', err);
            throw err;
        }
    }

    async updateRoom(roomId: number, data: { name: string; topic?: string | null; type?: string; bitrate?: number; user_limit?: number }): Promise<any> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('update_room', data, { room_id: roomId });
            return result.room;
        } catch (err) {
            console.error('Update room error:', err);
            throw err;
        }
    }

    async getRoomById(roomId: number): Promise<any | null> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('get_room_by_id', { room_id: roomId });
            return result.room || null;
        } catch (err) {
            console.error('Get room error:', err);
            return null;
        }
    }

    async getRoomMessages(roomId: number): Promise<any[]> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('get_room_messages', undefined, { room_id: roomId });
            return result.messages || [];
        } catch (err) {
            console.error('Get messages error:', err);
            return [];
        }
    }

    async sendMessage(roomId: number, content: string): Promise<any> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('send_message', { room_id: roomId, content });
            return result.message;
        } catch (err) {
            console.error('Send message error:', err);
            throw err;
        }
    }

    async getCurrentUser(sessionId: string): Promise<any | null> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('get_current_user', { session_id: sessionId });
            return result.user || null;
        } catch (err) {
            console.error('Get current user error:', err);
            return null;
        }
    }

    async getUserStats(userId: number): Promise<any | null> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('get_user_stats', { user_id: userId });
            return result.stats || null;
        } catch (err) {
            console.error('Get user stats error:', err);
            return null;
        }
    }

    async updateUserProfile(userId: number, data: any): Promise<boolean> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('update_user_profile', { user_id: userId, ...data });
            return result.success === true;
        } catch (err) {
            console.error('Update profile error:', err);
            return false;
        }
    }

    async getUserGuildsWithRole(userId: number): Promise<any[]> {
        try {
            await wsService.waitForAuth();
            const result = await wsService.request('get_user_guilds_with_role', { user_id: userId });
            return result.guilds || [];
        } catch (err) {
            console.error('Get user guilds with role error:', err);
            return [];
        }
    }
}

export const apiService = new ApiService();