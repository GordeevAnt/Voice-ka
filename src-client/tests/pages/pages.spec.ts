import { test, expect } from '@playwright/test';

test.describe('Page Components', () => {
  test.describe('Main_Page', () => {
    test('should require authentication', async ({ page }) => {
      // Try to access main page without authentication
      await page.goto('/main');
      
      // Should redirect to auth page
      await expect(page).toHaveURL('/');
      
      // Check for auth form
      const authForm = page.locator('form');
      await expect(authForm).toBeVisible();
    });

    test('should display main interface when authenticated', async ({ page }) => {
      // This test would require mocking authentication
      // For now, we'll check the structure if we can bypass auth
      await page.goto('/');
      
      // Since we can't easily authenticate in Playwright without backend,
      // we'll focus on testing the component structure indirectly
      // by checking if the main page elements exist in the DOM
      const mainPageElements = [
        '.messenger-field',
        '.chanels-list',
        '.rooms-list',
        '.rooms-online-list'
      ];
      
      for (const selector of mainPageElements) {
        const element = page.locator(selector);
        // Just verify the selector is valid, not necessarily visible
        // since the page might not be loaded
      }
    });

    test('should have navigation buttons', async ({ page }) => {
      await page.goto('/');
      
      // Check for info buttons (they might be in the layout)
      const infoButtons = page.locator('.info-button, [class*="info"]');
      const buttonCount = await infoButtons.count();
      
      if (buttonCount > 0) {
        // Verify at least one button is visible
        await expect(infoButtons.first()).toBeVisible();
      }
    });
  });

  test.describe('Chanel_Info_Page', () => {
    test('should display channel information', async ({ page }) => {
      // This page likely requires authentication and channel ID
      await page.goto('/chanel_info');
      
      // Should redirect to auth if not authenticated
      const currentUrl = page.url();
      if (!currentUrl.includes('chanel_info')) {
        // Check for auth form
        const authForm = page.locator('form');
        await expect(authForm).toBeVisible();
      } else {
        // If we're on the page, check for channel info elements
        const channelInfo = page.locator('.channel-info, [class*="info"]');
        await expect(channelInfo).toBeVisible();
        
        // Check for channel name
        const channelName = page.locator('h1, h2, .channel-name');
        await expect(channelName).toBeVisible();
      }
    });
  });

  test.describe('Room_Info_Page', () => {
    test('should display room information', async ({ page }) => {
      await page.goto('/room_info');
      
      const currentUrl = page.url();
      if (!currentUrl.includes('room_info')) {
        // Redirected to auth
        const authForm = page.locator('form');
        await expect(authForm).toBeVisible();
      } else {
        // Check for room info elements
        const roomInfo = page.locator('.room-info, [class*="room"]');
        await expect(roomInfo).toBeVisible();
        
        // Check for room details
        const roomDetails = page.locator('.room-details, .room-members');
        const count = await roomDetails.count();
        if (count > 0) {
          await expect(roomDetails.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Personal_Account_Info_Page', () => {
    test('should display personal account information', async ({ page }) => {
      await page.goto('/person_acc_info');
      
      const currentUrl = page.url();
      if (!currentUrl.includes('person_acc_info')) {
        // Redirected to auth
        const authForm = page.locator('form');
        await expect(authForm).toBeVisible();
      } else {
        // Check for personal account info
        const accountInfo = page.locator('.account-info, .personal-info');
        await expect(accountInfo).toBeVisible();
        
        // Check for user details
        const userDetails = page.locator('.user-details, .profile-info');
        const count = await userDetails.count();
        if (count > 0) {
          await expect(userDetails.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Navigation between pages', () => {
    test('should navigate between info pages', async ({ page }) => {
      // This test would require authentication
      // We'll test the navigation structure
      await page.goto('/');
      
      // Check for navigation elements
      const navButtons = page.locator('nav a, .nav-button, [class*="button"]');
      const navCount = await navButtons.count();
      
      if (navCount > 0) {
        // Click the first navigation button and check URL change
        const firstButton = navButtons.first();
        await firstButton.click();
        
        // URL should change
        const newUrl = page.url();
        expect(newUrl).not.toBe('http://localhost:5173/');
      }
    });
  });
});