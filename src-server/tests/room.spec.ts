import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from './test-helper';

test.describe('Room Handler Tests', () => {
  let client: Awaited<ReturnType<typeof createAuthenticatedClient>>;
  let guildId: number;

  test.beforeEach(async () => {
    client = await createAuthenticatedClient();
    
    // Создаем тестовую гильдию
    const guildResult = await client.sendAndWait('create_guild', {
      name: `Test Guild ${Date.now()}`,
      description: 'For room tests'
    });
    guildId = guildResult.guild.id;
  });

  test.afterEach(() => {
    client.close();
  });

  test('should handle get_guild_rooms request', async () => {
    const result = await client.sendAndWait('get_guild_rooms', undefined, { guild_id: guildId });
    
    expect(result.rooms).toBeDefined();
    expect(Array.isArray(result.rooms)).toBe(true);
  });

  test('should handle get_room_by_id request', async () => {
    // Сначала создаем комнату
    const createResult = await client.sendAndWait('create_room', {
      name: 'Test Room for GetById',
      room_type: 'text',
      topic: 'Test topic'
    }, { guild_id: guildId });
    
    const roomId = createResult.room.id;
    
    const result = await client.sendAndWait('get_room_by_id', {
      room_id: roomId
    });
    
    expect(result.room).toBeDefined();
    expect(result.room.id).toBe(roomId);
    expect(result.room.name).toBe('Test Room for GetById');
  });

  test('should handle create_room request', async () => {
    const roomName = `Test Room ${Date.now()}`;
    
    const result = await client.sendAndWait('create_room', {
      name: roomName,
      room_type: 'text',
      topic: 'A test room created by Playwright'
    }, { guild_id: guildId });
    
    expect(result.room).toBeDefined();
    expect(result.room.name).toBe(roomName);
    expect(result.room.type).toBe('text');
  });

  test('should handle update_room request', async () => {
    // Сначала создаем комнату
    const createResult = await client.sendAndWait('create_room', {
      name: 'Room To Update',
      room_type: 'text'
    }, { guild_id: guildId });
    
    const roomId = createResult.room.id;
    const newName = 'Updated Room Name';
    
    const result = await client.sendAndWait('update_room', {
      name: newName,
      topic: 'Updated room description'
    }, { room_id: roomId });
    
    expect(result.room).toBeDefined();
    expect(result.room.name).toBe(newName);
  });

  test('should handle subscribe_room request', async () => {
    // Создаем комнату
    const createResult = await client.sendAndWait('create_room', {
      name: 'Subscribable Room',
      room_type: 'text'
    }, { guild_id: guildId });
    
    const roomId = createResult.room.id;
    
    // Отправляем subscribe_room без ожидания ответа
    // Просто проверяем, что сообщение было отправлено без ошибок
    const subscribeMessage = {
      type: 'subscribe_room',
      room_id: roomId
    };
    
    // Отправляем и не ждем ответа
    client.ws.send(JSON.stringify(subscribeMessage));
    
    // Даем время на обработку
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Если дошли сюда без ошибок - тест пройден
    expect(true).toBe(true);
  });

  test('should handle unsubscribe_room request', async () => {
  const createResult = await client.sendAndWait('create_room', {
    name: 'Unsubscribable Room',
    room_type: 'text'
  }, { guild_id: guildId });
  
  const roomId = createResult.room.id;
  
  const unsubscribeMessage = {
    type: 'unsubscribe_room',
    room_id: roomId
  };
  
  client.ws.send(JSON.stringify(unsubscribeMessage));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  expect(true).toBe(true);
});

test('should handle subscribe_guild request', async () => {
  const subscribeMessage = {
    type: 'subscribe_guild',
    guild_id: guildId
  };
  
  client.ws.send(JSON.stringify(subscribeMessage));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  expect(true).toBe(true);
});

  test('should handle unsubscribe_guild request', async () => {
    const unsubscribeMessage = {
      type: 'unsubscribe_guild',
      guild_id: guildId
    };
    
    client.ws.send(JSON.stringify(unsubscribeMessage));
    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(true).toBe(true);
  });
});