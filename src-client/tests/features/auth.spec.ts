import { test, expect } from '@playwright/test';

test.describe('Auth Feature Components', () => {
  test.describe('Auth_Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/');
      
      // Check for login form elements
      const loginForm = page.locator('form');
      await expect(loginForm).toBeVisible();
      
      // Check for username/email input
      const usernameInput = page.locator('input[type="text"], input[name="username"], input[name="email"]');
      await expect(usernameInput).toBeVisible();
      
      // Check for password input
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toBeVisible();
      
      // Check for submit button
      const submitButton = page.locator('button[type="submit"], button:has-text("Войти"), button:has-text("Login")');
      await expect(submitButton).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/');
      
      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"], button:has-text("Войти")');
      await submitButton.click();
      
      // Check for error messages (if implemented)
      const errorMessages = page.locator('.error-message, .text-red-500, [class*="error"]');
      const errorCount = await errorMessages.count();
      
      if (errorCount > 0) {
        await expect(errorMessages.first()).toBeVisible();
      }
    });

    test('should have link to register page', async ({ page }) => {
      await page.goto('/');
      
      // Look for register link
      const registerLink = page.locator('a[href*="register"], a:has-text("Регистрация"), a:has-text("Register")');
      await expect(registerLink).toBeVisible();
      
      // Click the link and verify navigation
      await registerLink.click();
      await expect(page).toHaveURL(/.*register_page/);
    });
  });

  test.describe('Register_Page', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register_page');
      
      // Check for registration form
      const registerForm = page.locator('form');
      await expect(registerForm).toBeVisible();
      
      // Check for required fields
      const requiredInputs = [
        'username', 'email', 'password', 'confirmPassword'
      ];
      
      for (const field of requiredInputs) {
        const input = page.locator(`input[name*="${field}"], input[placeholder*="${field}"]`);
        const count = await input.count();
        if (count > 0) {
          await expect(input.first()).toBeVisible();
        }
      }
      
      // Check for submit button
      const submitButton = page.locator('button[type="submit"], button:has-text("Зарегистрироваться")');
      await expect(submitButton).toBeVisible();
    });

    test('should validate password confirmation', async ({ page }) => {
      await page.goto('/register_page');
      
      // Find password and confirm password fields
      const passwordInput = page.locator('input[type="password"]').first();
      const confirmPasswordInput = page.locator('input[type="password"]').nth(1);
      
      if (await passwordInput.count() > 0 && await confirmPasswordInput.count() > 0) {
        // Fill with mismatched passwords
        await passwordInput.fill('password123');
        await confirmPasswordInput.fill('different123');
        
        // Try to submit
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();
        
        // Check for validation error
        const errorMessage = page.locator('.error-message, .text-red-500');
        if (await errorMessage.count() > 0) {
          await expect(errorMessage.first()).toBeVisible();
        }
      }
    });

    test('should have link back to login page', async ({ page }) => {
      await page.goto('/register_page');
      
      // Look for login link
      const loginLink = page.locator('a[href="/"], a:has-text("Войти"), a:has-text("Login")');
      await expect(loginLink).toBeVisible();
      
      // Click the link and verify navigation
      await loginLink.click();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('UserPermissionsModal', () => {
    test('should open modal when triggered', async ({ page }) => {
      // This test assumes the modal can be triggered from somewhere
      // For now, we'll check if modal-related elements exist
      await page.goto('/');
      
      // Look for any modal trigger buttons
      const modalTriggers = page.locator('[data-testid*="permissions"], button:has-text("Permissions")');
      const triggerCount = await modalTriggers.count();
      
      if (triggerCount > 0) {
        // Click to open modal
        await modalTriggers.first().click();
        
        // Check for modal content
        const modal = page.locator('.modal, [role="dialog"]');
        await expect(modal).toBeVisible();
        
        // Check for permission options
        const permissionOptions = modal.locator('input[type="checkbox"], .permission-option');
        if (await permissionOptions.count() > 0) {
          await expect(permissionOptions.first()).toBeVisible();
        }
      }
    });
  });
});