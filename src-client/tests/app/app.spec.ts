import { test, expect } from '@playwright/test';

test.describe('App Component', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    // Check if the page contains the main layout
    await expect(page).toHaveTitle(/Voice-ka/);
    
    // Check for header presence
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('should navigate to auth page by default', async ({ page }) => {
    await page.goto('/');
    
    // Check for auth page elements
    const authForm = page.locator('form');
    await expect(authForm).toBeVisible();
    
    // Check for login inputs
    const usernameInput = page.locator('input[type="text"], input[name="username"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/');
    
    // Find and click register link
    const registerLink = page.locator('a[href*="register"]');
    if (await registerLink.count() > 0) {
      await registerLink.click();
      await expect(page).toHaveURL(/.*register_page/);
      
      // Check for registration form
      const registerForm = page.locator('form');
      await expect(registerForm).toBeVisible();
    }
  });
});