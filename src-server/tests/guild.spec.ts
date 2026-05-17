import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';

test.describe('Guild Handler Tests', () => {
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

  test('should handle get_user_guilds request', async () => {
    const getGuildsMessage = {
      message_type: 'get_user_guilds',
      request_id: 'guild-test-1',
      data: {
        // Note: This requires authentication
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_user_guilds response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-1') {
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

  test('should handle create_guild request', async () => {
    const createGuildMessage = {
      message_type: 'create_guild',
      request_id: 'guild-test-2',
      data: {
        name: `Test Guild ${Date.now()}`,
        description: 'A test guild created by Playwright',
        icon_url: 'https://example.com/icon.png'
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for create_guild response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-2') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(createGuildMessage));
    });
  });

  test('should handle join_guild request', async () => {
    const joinGuildMessage = {
      message_type: 'join_guild',
      request_id: 'guild-test-3',
      data: {
        guild_id: 1
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for join_guild response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-3') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(joinGuildMessage));
    });
  });

  test('should handle leave_guild request', async () => {
    const leaveGuildMessage = {
      message_type: 'leave_guild',
      request_id: 'guild-test-4',
      guild_id: 1,
      data: {
        guild_id: 1
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for leave_guild response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-4') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(leaveGuildMessage));
    });
  });

  test('should handle get_guild_members request', async () => {
    const getMembersMessage = {
      message_type: 'get_guild_members',
      request_id: 'guild-test-5',
      guild_id: 1
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_guild_members response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-5') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(getMembersMessage));
    });
  });

  test('should handle get_guild_roles request', async () => {
    const getRolesMessage = {
      message_type: 'get_guild_roles',
      request_id: 'guild-test-6',
      guild_id: 1
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_guild_roles response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-6') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(getRolesMessage));
    });
  });

  test('should handle get_user_roles_in_guild request', async () => {
    const getUserRolesMessage = {
      message_type: 'get_user_roles_in_guild',
      request_id: 'guild-test-7',
      data: {
        guild_id: 1
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_user_roles_in_guild response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-7') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(getUserRolesMessage));
    });
  });

  test('should handle get_user_permissions_in_guild request', async () => {
    const getPermissionsMessage = {
      message_type: 'get_user_permissions_in_guild',
      request_id: 'guild-test-8',
      data: {
        user_id: 1,
        guild_id: 1
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_user_permissions_in_guild response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-8') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(getPermissionsMessage));
    });
  });

  test('should handle find_guild_by_id request', async () => {
    const findGuildMessage = {
      message_type: 'find_guild_by_id',
      request_id: 'guild-test-9',
      data: {
        guild_id: 1
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for find_guild_by_id response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-9') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(findGuildMessage));
    });
  });

  test('should handle get_online_guild_members request', async () => {
    const getOnlineMembersMessage = {
      message_type: 'get_online_guild_members',
      request_id: 'guild-test-10',
      guild_id: 1
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_online_guild_members response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-10') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(getOnlineMembersMessage));
    });
  });

  test('should handle update_guild request', async () => {
    const updateGuildMessage = {
      message_type: 'update_guild',
      request_id: 'guild-test-11',
      guild_id: 1,
      data: {
        name: 'Updated Guild Name',
        description: 'Updated description'
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for update_guild response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'guild-test-11') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(updateGuildMessage));
    });
  });
});