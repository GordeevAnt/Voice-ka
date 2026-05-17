import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from './test-helper';

test.describe('Message Handler Tests', () => {
  let client: Awaited<ReturnType<typeof createAuthenticatedClient>>;
  let guildId: number;
  let roomId: number;

  test.beforeEach(async () => {
    client = await createAuthenticatedClient();
    
    // Создаем тестовую гильдию и комнату
    const guildResult = await client.sendAndWait('create_guild', {
      name: `Test Guild ${Date.now()}`,
      description: 'For message tests'
    });
    guildId = guildResult.guild.id;
    
    const roomResult = await client.sendAndWait('create_room', {
      name: 'Test Text Room',
      room_type: 'text',
      topic: 'Test room for messages'
    }, { guild_id: guildId });
    
    roomId = roomResult.room.id;
  });

  test.afterEach(() => {
    client.close();
  });

  test('should handle get_room_messages request', async () => {
    const result = await client.sendAndWait('get_room_messages', undefined, { room_id: roomId });
    
    expect(result.messages).toBeDefined();
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.room_id).toBe(roomId);
  });

  test('should handle send_message request', async () => {
    const messageContent = 'Test message from Playwright tests';
    
    const result = await client.sendAndWait('send_message', {
      room_id: roomId,
      content: messageContent
    });
    
    expect(result.message).toBeDefined();
    expect(result.message.content).toBe(messageContent);
    expect(result.message.room_id).toBe(roomId);
  });

  test('should handle send_message with different content types', async () => {
    const testCases = [
      { content: 'Simple text message', description: 'simple text' },
      { content: 'Message with emoji 😀', description: 'emoji' },
      { content: 'Message with special characters: @#$%^&*()', description: 'special characters' },
      { content: 'A'.repeat(100), description: 'long message' }
    ];

    for (const testCase of testCases) {
      const result = await client.sendAndWait('send_message', {
        room_id: roomId,
        content: testCase.content
      });
      
      expect(result.message.content).toBe(testCase.content);
    }
  });

  test('should handle message with attachments', async () => {
    const result = await client.sendAndWait('send_message', {
      room_id: roomId,
      content: 'Message with attachment',
      attachments: [
        {
          url: 'https://example.com/file.pdf',
          filename: 'document.pdf',
          filetype: 'application/pdf',
          size: 1024
        }
      ]
    });
    
    expect(result.message).toBeDefined();
    expect(result.message.content).toBe('Message with attachment');
  });
});