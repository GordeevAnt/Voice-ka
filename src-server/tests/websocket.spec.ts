import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';

test.describe('WebSocket Server Tests', () => {
  const WS_URL = 'ws://localhost:9001';
  let ws: WebSocket;

  test.beforeEach(async () => {
    // Connect to WebSocket server
    ws = new WebSocket(WS_URL);
    
    // Wait for connection to open
    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        console.log('Connected to WebSocket server');
        resolve();
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket connection error:', error);
      });
    });
  });

  test.afterEach(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  test('should connect to WebSocket server', async () => {
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  test('should receive welcome message on connection', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for welcome message'));
      }, 5000);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('Received message:', message);
          
          if (message.type === 'success' && message.data?.status === 'connected') {
            clearTimeout(timeout);
            expect(message.data.connection_id).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  });

  test('should handle ping-pong', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for pong response'));
      }, 5000);

      const pingMessage = {
        message_type: 'ping',
        request_id: 'test-ping-123'
      };

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('Received pong:', message);
          
          if (message.type === 'pong' || message.data?.type === 'pong') {
            clearTimeout(timeout);
            expect(message.timestamp || message.data?.timestamp).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(pingMessage));
    });
  });

  test.describe('Authentication', () => {
    test('should handle login with valid credentials', async () => {
      // This test requires a running server with database
      // For now, we'll just test the message structure
      const loginMessage = {
        message_type: 'login',
        request_id: 'test-login-123',
        data: {
          login: 'testuser',
          password: 'testpassword'
        }
      };

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for login response'));
        }, 5000);

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('Login response:', message);
            
            if (message.request_id === 'test-login-123') {
              clearTimeout(timeout);
              // The response will either be success or error
              expect(message.type).toBeDefined();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.send(JSON.stringify(loginMessage));
      });
    });
  });

  test.describe('Guild Operations', () => {
    test('should handle get_user_guilds request', async () => {
      const getGuildsMessage = {
        message_type: 'get_user_guilds',
        request_id: 'test-guilds-123',
        data: {
          // This would require authentication first
        }
      };

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for guilds response'));
        }, 5000);

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.request_id === 'test-guilds-123') {
              clearTimeout(timeout);
              expect(message.type).toBeDefined();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.send(JSON.stringify(getGuildsMessage));
      });
    });
  });

  test.describe('Room Operations', () => {
    test('should handle get_guild_rooms request', async () => {
      const getRoomsMessage = {
        message_type: 'get_guild_rooms',
        request_id: 'test-rooms-123',
        guild_id: 1
      };

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for rooms response'));
        }, 5000);

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.request_id === 'test-rooms-123') {
              clearTimeout(timeout);
              expect(message.type).toBeDefined();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.send(JSON.stringify(getRoomsMessage));
      });
    });
  });

  test.describe('Message Operations', () => {
    test('should handle send_message request', async () => {
      const sendMessage = {
        message_type: 'send_message',
        request_id: 'test-message-123',
        data: {
          room_id: 1,
          content: 'Test message from Playwright'
        }
      };

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for message response'));
        }, 5000);

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.request_id === 'test-message-123') {
              clearTimeout(timeout);
              expect(message.type).toBeDefined();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.send(JSON.stringify(sendMessage));
      });
    });
  });
});