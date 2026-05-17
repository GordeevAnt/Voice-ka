// src-server/tests/test-helper.ts
import { WebSocket } from 'ws';

export interface TestUser {
  id: number;
  username: string;
  sessionToken: string;
}

export async function createAuthenticatedClient(): Promise<{
  ws: WebSocket;
  user: TestUser;
  sendAndWait: (type: string, data?: any, options?: { guild_id?: number; room_id?: number }) => Promise<any>;
  close: () => void;
}> {
  const ws = new WebSocket('ws://localhost:9001');
  
  // Ждем подключения и приветствия
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    
    ws.on('error', reject);
  });

  // Функция для отправки и ожидания ответа
  const sendAndWait = (type: string, data?: any, options?: { guild_id?: number; room_id?: number }): Promise<any> => {
    return new Promise((resolve, reject) => {
      const requestId = `${type}-${Date.now()}-${Math.random()}`;
      const message: any = {
        type,
        request_id: requestId,
      };
      
      if (data) message.data = data;
      if (options?.guild_id) message.guild_id = options.guild_id;
      if (options?.room_id) message.room_id = options.room_id;
      
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${type} response`));
      }, 10000);
      
      const messageHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.request_id === requestId) {
            clearTimeout(timeout);
            ws.off('message', messageHandler);
            if (response.type === 'response' && response.success) {
              resolve(response.data);
            } else if (response.type === 'response' && !response.success) {
              reject(new Error(response.error || 'Request failed'));
            } else {
              resolve(response);
            }
          }
        } catch (err) {
          // Игнорируем ошибки парсинга
        }
      };
      
      ws.on('message', messageHandler);
      ws.send(JSON.stringify(message));
    });
  };

  // Регистрируем тестового пользователя
  const testUsername = `test_${Date.now()}`;
  const testEmail = `${testUsername}@test.com`;
  const testPassword = 'Test123!@#';
  
  try {
    await sendAndWait('register', {
      login: testUsername,
      email: testEmail,
      password: testPassword,
      confirm_password: testPassword
    });
  } catch (err) {
    // Пользователь возможно уже существует, пробуем логин
  }
  
  // Логинимся
  const loginResult = await sendAndWait('login', {
    login: testUsername,
    password: testPassword,
    ip_address: '127.0.0.1',
    user_agent: 'Playwright Test'
  });
  
  const user: TestUser = {
    id: loginResult.user_id,
    username: loginResult.username,
    sessionToken: loginResult.session_token
  };
  
  // Аутентифицируем WebSocket соединение
  await sendAndWait('auth', {
    session_token: user.sessionToken
  });
  
  return {
    ws,
    user,
    sendAndWait,
    close: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
  };
}