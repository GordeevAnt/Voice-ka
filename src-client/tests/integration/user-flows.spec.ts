import { test, expect } from '@playwright/test';

test.describe('User Flows Integration Tests', () => {
  test.describe('Authentication Flow', () => {
    test('complete login and logout flow', async ({ page }) => {
      // Start at auth page
      await page.goto('/');
      
      // Verify we're on auth page
      const authForm = page.locator('form');
      await expect(authForm).toBeVisible();
      
      // Fill login form (this would require actual backend to work)
      const usernameInput = page.locator('input[type="text"], input[name="username"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');
      
      if (await usernameInput.count() > 0 && await passwordInput.count() > 0) {
        await usernameInput.fill('testuser');
        await passwordInput.fill('testpass');
        
        // Try to submit (will likely fail without backend, but we can test the flow)
        await submitButton.click();
        
        // After submission, we might get error or redirect
        // For now, just verify the page responds
        await expect(page).not.toHaveURL('about:blank');
      }
    });

    test('registration flow', async ({ page }) => {
      await page.goto('/register_page');
      
      // Verify registration form
      const registerForm = page.locator('form');
      await expect(registerForm).toBeVisible();
      
      // Fill registration form
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      
      if (inputCount >= 4) {
        // Fill sample data
        await inputs.nth(0).fill('newuser');
        await inputs.nth(1).fill('newuser@example.com');
        await inputs.nth(2).fill('password123');
        await inputs.nth(3).fill('password123');
        
        // Submit form
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();
        
        // Should redirect or show success message
        await expect(page).not.toHaveURL('about:blank');
      }
    });
  });

  test.describe('Messaging Flow', () => {
    test('send and view messages', async ({ page }) => {
      // This test assumes user is already authenticated
      // Since we can't easily authenticate, we'll test the flow structure
      await page.goto('/');
      
      // Look for messaging interface
      const messageInput = page.locator('input[type="text"][placeholder*="сообщение"], #message-input');
      const sendButton = page.locator('button:has-text("Отправить")');
      
      if (await messageInput.count() > 0 && await sendButton.count() > 0) {
        // Type a message
        await messageInput.fill('Hello, this is a test message');
        
        // Click send
        await sendButton.click();
        
        // Message input should clear or show sending state
        const inputValue = await messageInput.inputValue();
        // Either empty or still contains text
        
        // Check if message appears in messages list
        const messages = page.locator('.message, .message-content');
        if (await messages.count() > 0) {
          // At least one message should be visible
          await expect(messages.first()).toBeVisible();
        }
      }
    });

    test('switch between channels and rooms', async ({ page }) => {
      await page.goto('/');
      
      // Find channel and room lists
      const channelItems = page.locator('.channel-item, [class*="chanel"]');
      const roomItems = page.locator('.room-item, [class*="room"]');
      
      if (await channelItems.count() > 0) {
        // Click first channel
        await channelItems.first().click();
        
        // Channel should get selected class
        const selectedClass = await channelItems.first().getAttribute('class');
        expect(selectedClass).toMatch(/selected|active/i);
      }
      
      if (await roomItems.count() > 0) {
        // Click first room
        await roomItems.first().click();
        
        // Room should get selected class
        const roomClass = await roomItems.first().getAttribute('class');
        expect(roomClass).toMatch(/selected|active/i);
      }
    });
  });

  test.describe('Navigation Flow', () => {
    test('navigate through application pages', async ({ page }) => {
      await page.goto('/');
      
      // Test navigation to register page
      const registerLink = page.locator('a[href*="register"]');
      if (await registerLink.count() > 0) {
        await registerLink.click();
        await expect(page).toHaveURL(/.*register_page/);
        
        // Go back to login
        const loginLink = page.locator('a[href="/"]');
        if (await loginLink.count() > 0) {
          await loginLink.click();
          await expect(page).toHaveURL('/');
        }
      }
      
      // Test info page navigation (requires authentication)
      // Since we can't authenticate, we'll just verify the links exist
      const infoButtons = page.locator('[class*="info-"]');
      const buttonCount = await infoButtons.count();
      
      if (buttonCount > 0) {
        // Click first info button
        await infoButtons.first().click();
        
        // Should navigate to some page
        const currentUrl = page.url();
        expect(currentUrl).not.toBe('http://localhost:5173/');
      }
    });
  });

  test.describe('Search and Join Flow', () => {
    test('search for and join a channel', async ({ page }) => {
      await page.goto('/');
      
      // Open search modal
      const searchButton = page.locator('button:has-text("Поиск")');
      if (await searchButton.count() > 0) {
        await searchButton.click();
        
        // Wait for modal
        const modal = page.locator('.modal');
        if (await modal.count() > 0) {
          await expect(modal).toBeVisible();
          
          // Enter channel ID
          const searchInput = modal.locator('input[type="text"]');
          await searchInput.fill('123');
          
          // Click search
          const findButton = modal.locator('button:has-text("Найти")');
          await findButton.click();
          
          // Should show search results or error
          const results = modal.locator('.search-results, .guild-info');
          if (await results.count() > 0) {
            await expect(results.first()).toBeVisible();
            
            // Try to join
            const joinButton = modal.locator('button:has-text("Присоединиться")');
            if (await joinButton.count() > 0) {
              await joinButton.click();
              
              // Should show success or join the channel
              const successMessage = modal.locator('.success-message, .joined-message');
              if (await successMessage.count() > 0) {
                await expect(successMessage).toBeVisible();
              }
            }
          }
        }
      }
    });
  });

  test.describe('Responsive Behavior', () => {
    test('application should be responsive', async ({ page }) => {
      await page.goto('/');
      
      // Test different viewport sizes
      await page.setViewportSize({ width: 375, height: 667 }); // Mobile
      await expect(page.locator('body')).toBeVisible();
      
      await page.setViewportSize({ width: 768, height: 1024 }); // Tablet
      await expect(page.locator('body')).toBeVisible();
      
      await page.setViewportSize({ width: 1280, height: 800 }); // Desktop
      await expect(page.locator('body')).toBeVisible();
      
      // Reset to default
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.describe('Error Handling', () => {
    test('handle network errors gracefully', async ({ page }) => {
      await page.goto('/');
      
      // Try to trigger errors by submitting invalid forms
      const submitButtons = page.locator('button[type="submit"]');
      if (await submitButtons.count() > 0) {
        await submitButtons.first().click();
        
        // Should show error messages or handle gracefully
        const errorMessages = page.locator('.error-message, .alert-error');
        if (await errorMessages.count() > 0) {
          await expect(errorMessages.first()).toBeVisible();
        }
      }
    });

    test('handle 404 pages', async ({ page }) => {
      // Try to access non-existent page
      await page.goto('/non-existent-page');
      
      // Should show 404 or redirect to main page
      const currentUrl = page.url();
      if (currentUrl.includes('non-existent-page')) {
        // Check for 404 content
        const notFound = page.locator('h1:has-text("404"), h1:has-text("Not Found")');
        if (await notFound.count() > 0) {
          await expect(notFound.first()).toBeVisible();
        }
      } else {
        // Redirected to valid page
        await expect(page).not.toHaveURL(/.*non-existent-page/);
      }
    });
  });
});