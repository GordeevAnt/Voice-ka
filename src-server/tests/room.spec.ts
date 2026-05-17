import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';

test.describe('Room Handler Tests', () => {
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

  test('should handle get_guild_rooms request', async () => {
    const getRoomsMessage = {
      message_type: 'get_guild_rooms',
      request_id: 'room-test-1',
      guild_id: 1
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_guild_rooms response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'room-test-1') {
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

  test('should handle get_room_by_id request', async () => {
    const getRoomMessage = {
      message_type: 'get_room_by_id',
      request_id: 'room-test-2',
      data: {
        room_id: 1
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_room_by_id response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'room-test-2') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(getRoomMessage));
    });
  });

  test('should handle create_room request', async () => {
    const createRoomMessage = {
      message_type: 'create_room',
      request_id: 'room-test-3',
      guild_id: 1,
      data: {
        name: `Test Room ${Date.now()}`,
        description: 'A test room created by Playwright',
        room_type: 'text',
        is_private: false,
        max_users: 50
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for create_room response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'room-test-3') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(createRoomMessage));
    });
  });

  test('should handle update_room request', async () => {
    const updateRoomMessage = {
      message_type: 'update_room',
      request_id: 'room-test-4',
      room_id: 1,
      data: {
        name: 'Updated Room Name',
        description: 'Updated room description'
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for update_room response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'room-test-4') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(updateRoomMessage));
    });
  });

  test('should handle subscribe_room request', async () => {
    const subscribeMessage = {
      message_type: 'subscribe_room',
      request_id: 'room-test-5',
      room_id: 1
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for subscribe_room response'));
      }, 5000);

      // Note: subscribe_room might not send a response
      // We'll just verify the message was sent without error
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      setTimeout(() => {
        clearTimeout(timeout);
        // If we get here without error, the message was sent successfully
        resolve();
      }, 1000);

      ws.send(JSON.stringify(subscribeMessage));
    });
  });

  test('should handle unsubscribe_room request', async () => {
    const unsubscribeMessage = {
      message_type: 'unsubscribe_room',
      request_id: 'room-test-6',
      room_id: 1
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for unsubscribe_room response'));
      }, 5000);

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 1000);

      ws.send(JSON.stringify(unsubscribeMessage));
    });
  });

  test('should handle subscribe_guild request', async () => {
    const subscribeGuildMessage = {
      message_type: 'subscribe_guild',
      request_id: 'room-test-7',
      guild_id: 1
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for subscribe_guild response'));
      }, 5000);

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 1000);

      ws.send(JSON.stringify(subscribeGuildMessage));
    });
  });

  test('should handle unsubscribe_guild request', async () => {
    const unsubscribeGuildMessage = {
      message_type: 'unsubscribe_guild',
      request_id: 'room-test-8',
      guild_id: 1
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for unsubscribe_guild response'));
      }, 5000);

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 1000);

      ws.send(JSON.stringify(unsubscribeGuildMessage));
    });
  });
});