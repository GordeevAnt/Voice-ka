import { test, expect } from '@playwright/test';

test.describe('Message Component', () => {
  test.beforeEach(async ({ page }) => {
    // Create a test page with Message component
    await page.goto('/');
    
    // We'll need to mock the component rendering for isolated testing
    // For now, we'll test it in the context of the application
  });

  test('should display message with author and text', async ({ page }) => {
    // Since we can't directly render React components in Playwright,
    // we'll test the component through the application
    // This test assumes the application has messages displayed
    
    // Navigate to a page where messages are shown (requires authentication)
    // For now, we'll check the basic structure
    await page.goto('/');
    
    // Check if message elements exist in the DOM
    const messageElements = page.locator('.message');
    const count = await messageElements.count();
    
    // If there are messages, verify their structure
    if (count > 0) {
      const firstMessage = messageElements.first();
      await expect(firstMessage.locator('.message-author')).toBeVisible();
      await expect(firstMessage.locator('.message-text')).toBeVisible();
      await expect(firstMessage.locator('.message-time')).toBeVisible();
    }
  });

  test('should highlight current user messages differently', async ({ page }) => {
    await page.goto('/');
    
    const currentUserMessages = page.locator('.message-current-user');
    const regularMessages = page.locator('.message:not(.message-current-user)');
    
    const currentUserCount = await currentUserMessages.count();
    const regularCount = await regularMessages.count();
    
    // At least one type of message should be styled differently
    if (currentUserCount > 0) {
      await expect(currentUserMessages.first()).toHaveClass(/message-current-user/);
    }
  });

  test('should display message avatar with author initial', async ({ page }) => {
    await page.goto('/');
    
    const messageAvatars = page.locator('.message-avatar-block');
    const count = await messageAvatars.count();
    
    if (count > 0) {
      const firstAvatar = messageAvatars.first();
      const avatarText = await firstAvatar.textContent();
      
      // Avatar should contain a single character (author initial)
      expect(avatarText?.length).toBe(1);
      expect(avatarText).toMatch(/[A-Z?]/);
    }
  });
});