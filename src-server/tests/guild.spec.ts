import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from './test-helper';

test.describe('Guild Handler Tests', () => {
  let client: Awaited<ReturnType<typeof createAuthenticatedClient>>;

  test.beforeEach(async () => {
    client = await createAuthenticatedClient();
  });

  test.afterEach(() => {
    client.close();
  });

  test('should handle get_user_guilds request', async () => {
    const result = await client.sendAndWait('get_user_guilds');
    expect(result.guilds).toBeDefined();
    expect(Array.isArray(result.guilds)).toBe(true);
  });

  test('should handle create_guild request', async () => {
    const guildName = `Test Guild ${Date.now()}`;
    const result = await client.sendAndWait('create_guild', {
      name: guildName,
      description: 'Test guild created by Playwright'
    });
    
    expect(result.guild).toBeDefined();
    expect(result.guild.name).toBe(guildName);
  });

  test('should handle get_guild_members request', async () => {
    // Сначала создаем гильдию
    const createResult = await client.sendAndWait('create_guild', {
      name: `Members Test ${Date.now()}`,
      description: 'Testing members'
    });
    
    const guildId = createResult.guild.id;
    
    const result = await client.sendAndWait('get_guild_members', undefined, { guild_id: guildId });
    expect(result.members).toBeDefined();
    expect(Array.isArray(result.members)).toBe(true);
  });
});