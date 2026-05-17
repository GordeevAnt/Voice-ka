import { test, expect } from '@playwright/test';
import { createAuthenticatedClient, TestUser } from './test-helper';

test.describe('Auth Handler Tests', () => {
  let client: Awaited<ReturnType<typeof createAuthenticatedClient>>;
  let user: TestUser;

  test.beforeEach(async () => {
    client = await createAuthenticatedClient();
    user = client.user;
  });

  test.afterEach(() => {
    client.close();
  });

  test('should handle login request structure', async () => {
    // Уже аутентифицированы через beforeEach
    expect(user.id).toBeGreaterThan(0);
    expect(user.sessionToken).toBeTruthy();
  });

  test('should handle register request', async () => {
    const newUsername = `newuser_${Date.now()}`;
    const result = await client.sendAndWait('register', {
      login: newUsername,
      email: `${newUsername}@test.com`,
      password: 'Test123!@#',
      confirm_password: 'Test123!@#'
    });
    
    expect(result.user_id).toBeGreaterThan(0);
  });

  test('should handle get_current_user request', async () => {
    const result = await client.sendAndWait('get_current_user', {
      session_id: user.sessionToken
    });
    
    expect(result.user).toBeDefined();
    expect(result.user.id).toBe(user.id);
    expect(result.user.username).toBe(user.username);
  });

  test('should handle get_user_stats request', async () => {
    const result = await client.sendAndWait('get_user_stats', {
      user_id: user.id
    });
    
    expect(result.stats).toBeDefined();
    expect(typeof result.stats.total_messages).toBe('number');
  });

  test('should handle logout request', async () => {
    const result = await client.sendAndWait('logout', {}, { guild_id: 1 });
    expect(result.success).toBe(true);
  });
});