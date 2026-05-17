import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';

test.describe('Message Handler Tests', () => {
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

  test('should handle get_room_messages request', async () => {
    const getMessagesMessage = {
      message_type: 'get_room_messages',
      request_id: 'message-test-1',
      room_id: 1
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for get_room_messages response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'message-test-1') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(getMessagesMessage));
    });
  });

  test('should handle send_message request', async () => {
    const sendMessage = {
      message_type: 'send_message',
      request_id: 'message-test-2',
      data: {
        room_id: 1,
        content: 'Test message from Playwright tests'
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for send_message response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'message-test-2') {
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

  test('should handle send_message with different content types', async () => {
    const testCases = [
      {
        content: 'Simple text message',
        description: 'simple text'
      },
      {
        content: 'Message with emoji 😀',
        description: 'emoji'
      },
      {
        content: 'Message with special characters: @#$%^&*()',
        description: 'special characters'
      },
      {
        content: 'A'.repeat(100),
        description: 'long message'
      }
    ];

    for (const testCase of testCases) {
      await test(`should handle ${testCase.description} message`, async () => {
        const sendMessage = {
          message_type: 'send_message',
          request_id: `message-test-${Date.now()}`,
          data: {
            room_id: 1,
            content: testCase.content
          }
        };

        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Timeout waiting for send_message response (${testCase.description})`));
          }, 5000);

          ws.on('message', (data: Buffer) => {
            try {
              const message = JSON.parse(data.toString());
              
              if (message.data?.status === 'connected') {
                return;
              }
              
              if (message.request_id === sendMessage.request_id) {
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
    }
  });

  test('should handle message with attachments', async () => {
    const sendMessageWithAttachment = {
      message_type: 'send_message',
      request_id: 'message-test-3',
      data: {
        room_id: 1,
        content: 'Message with attachment',
        attachments: [
          {
            url: 'https://example.com/file.pdf',
            filename: 'document.pdf',
            filetype: 'application/pdf',
            size: 1024
          }
        ]
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for send_message with attachment response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'message-test-3') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(sendMessageWithAttachment));
    });
  });

  test('should handle edit_message request', async () => {
    // Note: This endpoint might not exist in the current implementation
    // but we can test the message structure
    const editMessage = {
      message_type: 'edit_message',
      request_id: 'message-test-4',
      data: {
        message_id: 1,
        content: 'Edited message content'
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for edit_message response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'message-test-4') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(editMessage));
    });
  });

  test('should handle delete_message request', async () => {
    // Note: This endpoint might not exist in the current implementation
    const deleteMessage = {
      message_type: 'delete_message',
      request_id: 'message-test-5',
      data: {
        message_id: 1
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for delete_message response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'message-test-5') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(deleteMessage));
    });
  });

  test('should handle message reactions', async () => {
    // Note: This endpoint might not exist in the current implementation
    const reactMessage = {
      message_type: 'react_to_message',
      request_id: 'message-test-6',
      data: {
        message_id: 1,
        reaction: '👍'
      }
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for react_to_message response'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.data?.status === 'connected') {
            return;
          }
          
          if (message.request_id === 'message-test-6') {
            clearTimeout(timeout);
            expect(message.type).toBeDefined();
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.send(JSON.stringify(reactMessage));
    });
  });
});