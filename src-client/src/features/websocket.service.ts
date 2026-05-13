// src/features/websocket.service.ts
import { storeAPI } from './useStore';

type MessageHandler = (data: any) => void;

interface Request {
    id: string;
    type: string;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
}

class WebSocketService {
    private ws: WebSocket | null = null;
    private isConnected = false;
    private isAuthenticated = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000;
    private pendingRequests = new Map<string, Request>();
    private eventHandlers = new Map<string, Set<MessageHandler>>();
    private connectionListeners = new Set<(connected: boolean) => void>();
    private authListeners = new Set<(authenticated: boolean) => void>();
    private sessionToken: string | null = null;
    private userId: number | null = null;
    private pendingAuthPromise: Promise<void> | null = null;
    private resolveAuthPromise: (() => void) | null = null;

    constructor() {
        this.init();
    }

    private async init() {
        this.sessionToken = await storeAPI.get<string>('session_id');
        this.userId = await storeAPI.get<number>('user_id');
        this.connect();
    }

    private connect() {
        if (this.ws?.readyState === WebSocket.OPEN || 
            this.ws?.readyState === WebSocket.CONNECTING) {
            return;
        }

        console.log('🔌 Connecting to WebSocket...');
        this.ws = new WebSocket('ws://127.0.0.1:9001');

        this.ws.onopen = () => {
            console.log('🟢 WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            this.notifyConnectionListeners();

            // Если есть сохраненный токен, отправляем аутентификацию
            if (this.sessionToken) {
                console.log('🔐 Sending auth with existing token...');
                this.sendAuth(this.sessionToken);
            } else {
                // Создаем промис, который будет разрешен при успешной аутентификации
                this.pendingAuthPromise = new Promise((resolve) => {
                    this.resolveAuthPromise = resolve;
                });
                this.isAuthenticated = false;
                this.notifyAuthListeners();
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (err) {
                console.error('Failed to parse message:', err);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`🔴 WebSocket disconnected (code: ${event.code})`);
            this.isConnected = false;
            this.isAuthenticated = false;
            this.notifyConnectionListeners();
            this.notifyAuthListeners();
            
            if (event.code !== 1000 && event.code !== 1001) {
                this.handleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    private sendAuth(sessionToken: string) {
        const requestId = this.generateRequestId();
        const payload = {
            type: 'auth',
            request_id: requestId,
            data: { session_token: sessionToken }
        };
        
        // Создаем промис для ожидания ответа
        this.pendingAuthPromise = new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, {
                id: requestId,
                type: 'auth',
                resolve: (result) => {
                    if (result.success) {
                        this.isAuthenticated = true;
                        this.userId = result.user_id;
                        console.log('✅ WebSocket authenticated');
                        if (this.resolveAuthPromise) {
                            this.resolveAuthPromise();
                            this.resolveAuthPromise = null;
                        }
                        this.notifyAuthListeners();
                        resolve(result);
                    } else {
                        this.isAuthenticated = false;
                        reject(new Error('Authentication failed'));
                    }
                },
                reject: (err) => {
                    this.isAuthenticated = false;
                    reject(err);
                }
            });
            
            this.ws!.send(JSON.stringify(payload));
            
            // Таймаут на случай отсутствия ответа
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Auth timeout'));
                }
            }, 10000);
        });
    }

    private handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
        
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }

    // Ожидание аутентификации
    async waitForAuth(): Promise<void> {
        console.log('⏳ waitForAuth called, isAuthenticated:', this.isAuthenticated);
        if (this.isAuthenticated) {
            console.log('✅ Already authenticated');
            return;
        }
        if (this.pendingAuthPromise) {
            console.log('⏳ Waiting for auth promise...');
            await this.pendingAuthPromise;
            console.log('✅ Auth promise resolved');
        } else {
            console.log('⚠️ No auth promise, waiting 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    getCurrentUserId(): number | null {
        return this.userId;
    }

    private async handleMessage(message: any) {
        // Обработка ответов на запросы
        if (message.request_id && this.pendingRequests.has(message.request_id)) {
            const request = this.pendingRequests.get(message.request_id)!;
            this.pendingRequests.delete(message.request_id);
            
            if (message.success) {
                request.resolve(message.data);
            } else {
                request.reject(new Error(message.error || 'Request failed'));
            }
            return;
        }

        // Обработка событий (broadcast)
        if (message.type && this.eventHandlers.has(message.type)) {
            const handlers = this.eventHandlers.get(message.type)!;
            handlers.forEach(handler => handler(message.data));
        }

        if (message.type === 'user_permissions_updated') {
            // Обновляем кэш прав пользователя
            const { guild_id, permissions, user_id } = message.data;
            if (user_id === this.userId) {
                // Сохраняем обновленные права в хранилище
                await storeAPI.set(`user_permissions_${guild_id}`, permissions);
            }
            this.notifyEventHandlers(message.type, message.data);
            return;
        }
        
        if (message.type === 'user_roles_updated') {
            // Очищаем кэш ролей для этой гильдии у пользователя
            const { guild_id, user_id } = message.data;
            if (user_id === this.userId) {
                await storeAPI.delete(`guild_${guild_id}_user_roles`);
            }
            this.notifyEventHandlers(message.type, message.data);
            return;
        }

        if (message.type === 'role_permissions_updated') {
            // Обновляем кэш прав для всех пользователей, у которых есть эта роль
            const { guild_id, role_id, permissions } = message.data;
            
            // Здесь можно обновить кэш, если нужно
            console.log(`Role ${role_id} permissions updated to ${permissions} in guild ${guild_id}`);
            
            this.notifyEventHandlers(message.type, message.data);
            return;
        }
    }

    public notifyEventHandlers(type: string, data: any) {
        if (this.eventHandlers.has(type)) {
            const handlers = this.eventHandlers.get(type)!;
            handlers.forEach(handler => handler(data));
        }
    }

    public triggerEvent(type: string, data: any) {
        if (this.eventHandlers.has(type)) {
            const handlers = this.eventHandlers.get(type)!;
            handlers.forEach(handler => handler(data));
        }
    }

    async request(type: string, data?: any, options?: { room_id?: number; guild_id?: number }): Promise<any> {
        console.log(`📤 Sending request: ${type}`, { data, options });
        
        // Ждем подключения
        if (!this.isConnected) {
            console.log('⏳ Waiting for connection...');
            await new Promise<void>((resolve) => {
                const unsubscribe = this.onConnectionChange((connected) => {
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
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        const requestId = this.generateRequestId();
        
        const payload: any = {
            type,
            request_id: requestId,
        };
        
        if (data) payload.data = data;
        if (options?.room_id) payload.room_id = options.room_id;
        if (options?.guild_id) payload.guild_id = options.guild_id;
        
        console.log(`📤 Sending payload:`, payload);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    console.error(`❌ Request timeout: ${type}`);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
            
            this.pendingRequests.set(requestId, { 
                id: requestId, 
                type, 
                resolve: (value) => {
                    clearTimeout(timeout);
                    console.log(`✅ Request resolved: ${type}`, value);
                    resolve(value);
                }, 
                reject: (reason) => {
                    clearTimeout(timeout);
                    console.error(`❌ Request rejected: ${type}`, reason);
                    reject(reason);
                }
            });
            
            this.ws!.send(JSON.stringify(payload));
        });
    }

    async authenticate(token: string, userId: number): Promise<void> {
        console.log('🔐 Authenticating with token on existing connection...');
        this.sessionToken = token;
        this.userId = userId;
        
        // Сохраняем в хранилище
        await storeAPI.set('session_id', token);
        await storeAPI.set('user_id', userId);
        await storeAPI.set('token', 'true');
        
        // Отправляем auth запрос
        await this.sendAuth(token);
        
        console.log('✅ Authentication completed on existing connection');
    }

    notify(type: string, data?: any, options?: { room_id?: number; guild_id?: number }) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not connected, cannot send notification');
            return;
        }

        const payload: any = { type };
        if (data) payload.data = data;
        if (options?.room_id) payload.room_id = options.room_id;
        if (options?.guild_id) payload.guild_id = options.guild_id;
        
        this.ws.send(JSON.stringify(payload));
    }

    on(eventType: string, handler: MessageHandler): () => void {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, new Set());
        }
        this.eventHandlers.get(eventType)!.add(handler);
        
        return () => {
            this.eventHandlers.get(eventType)?.delete(handler);
        };
    }

    subscribeRoom(roomId: number) {
        this.notify('subscribe_room', undefined, { room_id: roomId });
    }

    unsubscribeRoom(roomId: number) {
        this.notify('unsubscribe_room', undefined, { room_id: roomId });
    }

    subscribeGuild(guildId: number) {
        this.notify('subscribe_guild', undefined, { guild_id: guildId });
    }

    unsubscribeGuild(guildId: number) {
        this.notify('unsubscribe_guild', undefined, { guild_id: guildId });
    }

    getConnectionStatus(): boolean {
        return this.isConnected;
    }

    getAuthStatus(): boolean {
        return this.isAuthenticated;
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void {
        this.connectionListeners.add(listener);
        return () => {
            this.connectionListeners.delete(listener);
        };
    }

    onAuthChange(listener: (authenticated: boolean) => void): () => void {
        this.authListeners.add(listener);
        return () => {
            this.authListeners.delete(listener);
        };
    }

    private notifyConnectionListeners() {
        this.connectionListeners.forEach(listener => listener(this.isConnected));
    }

    private notifyAuthListeners() {
        this.authListeners.forEach(listener => listener(this.isAuthenticated));
    }

    private generateRequestId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Normal closure');
            this.ws = null;
        }
        this.isConnected = false;
        this.isAuthenticated = false;
    }
}

export const wsService = new WebSocketService();