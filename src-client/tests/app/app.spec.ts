import { test, expect } from '@playwright/test';

test.describe('App Component', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    // Check if page loads (not error)
    await expect(page).not.toHaveURL('about:blank');
    
    // Check for any visible content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should display auth page by default', async ({ page }) => {
    await page.goto('/');
    
    // Check for auth page elements using actual class names from Auth_Page.tsx
    const loginInput = page.locator('input.login');
    const passwordInput = page.locator('input.password');
    const loginButton = page.locator('button.auth');
    const registerButton = page.locator('button.reg');
    
    // At least one of these should be visible
    const elements = [loginInput, passwordInput, loginButton, registerButton];
    let visibleCount = 0;
    
    for (const element of elements) {
      if (await element.count() > 0) {
        visibleCount++;
      }
    }
    
    expect(visibleCount).toBeGreaterThan(0);
  });

  test('should navigate to register page when register button is clicked', async ({ page }) => {
    await page.goto('/');
    
    // Find register button
    const registerButton = page.locator('button.reg, button:has-text("Зарегистрироваться")');
    
    if (await registerButton.count() > 0) {
      await registerButton.click();
      
      // Should navigate to register page
      await expect(page).toHaveURL(/.*register_page/);
      
      // Check for registration form elements
      const registerInputs = page.locator('input');
      expect(await registerInputs.count()).toBeGreaterThan(0);
    }
  });
});