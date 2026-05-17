import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';

test.describe('Auth Handler Tests', () => {
  const WS_URL = 'ws://localhost:9001';
  let ws: WebSocket;

  test.beforeEach(async () => {
    // Connect to WebSocket server
    ws = new WebSocket(WS_URL);
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });

  test.afterEach(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  test('should handle login request structure', async () => {
    const loginMessage = {
      message_type: 'login',
      request_id: 'auth-test-1',
      data: {
        login: 'testuser',
        password: 'testpassword123',
        ip_address: '127.0.0.1',
        user_agent: 'Playwright Test'
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for login response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Skip welcome message
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'auth-test-1') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            // Response should be either 'success' or 'error'
            expect(['success', 'error']).toContain(message.type);
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

  test('should handle register request', async () => {
    const registerMessage = {
      message_type: 'register',
      request_id: 'auth-test-2',
      data: {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'securepassword123',
        confirmPassword: 'securepassword123'
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for register response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'auth-test-2') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(registerMessage));
    });
  });

  test('should handle logout request', async () => {
    // First we need to login to get a session token
    // For now, test the message structure
    const logoutMessage = {
      message_type: 'logout',
      request_id: 'auth-test-3',
      session_token: 'test-session-token'
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for logout response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'auth-test-3') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(logoutMessage));
    });
  });

  test('should handle get_current_user request', async () => {
    const getCurrentUserMessage = {
      message_type: 'get_current_user',
      request_id: 'auth-test-4',
      data: {
        session_id: 'test-session-id'
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_current_user response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'auth-test-4') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(getCurrentUserMessage));
    });
  });

  test('should handle get_user_stats request', async () => {
    const getUserStatsMessage = {
      message_type: 'get_user_stats',
      request_id: 'auth-test-5',
      data: {
        user_id: 1
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_user_stats response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'auth-test-5') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(getUserStatsMessage));
    });
  });

  test('should handle update_user_profile request', async () => {
    const updateProfileMessage = {
      message_type: 'update_user_profile',
      request_id: 'auth-test-6',
      data: {
        display_name: 'Updated Name',
        avatar_url: 'https://example.com/avatar.jpg',
        status: 'online'
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for update_user_profile response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'auth-test-6') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(updateProfileMessage));
    });
  });
});