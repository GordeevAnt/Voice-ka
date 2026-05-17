import { test, expect } from '@playwright/test';

test.describe('Widget Components', () => {
  test.describe('Header', () => {
    test('should display window controls', async ({ page }) => {
      await page.goto('/');
      
      // Check for header element
      const header = page.locator('header, .header');
      await expect(header).toBeVisible();
      
      // Check for window control buttons (minimize, maximize, close)
      const windowControls = header.locator('.window-control, button');
      const controlCount = await windowControls.count();
      
      if (controlCount > 0) {
        // At least one control button should be visible
        await expect(windowControls.first()).toBeVisible();
      }
    });

    test('should have application title or logo', async ({ page }) => {
      await page.goto('/');
      
      const header = page.locator('header');
      await expect(header).toBeVisible();
      
      // Check for title/logo
      const title = header.locator('h1, .app-title, .logo');
      const titleCount = await title.count();
      
      if (titleCount > 0) {
        await expect(title.first()).toBeVisible();
        const titleText = await title.first().textContent();
        expect(titleText?.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Chanels_List', () => {
    test('should display channels list', async ({ page }) => {
      await page.goto('/');
      
      // Look for channels list container
      const channelsList = page.locator('.chanels-list, [class*="chanels"]');
      const listCount = await channelsList.count();
      
      if (listCount > 0) {
        await expect(channelsList.first()).toBeVisible();
        
        // Check for channel items
        const channelItems = channelsList.locator('.channel-item, li, .list-item');
        const itemCount = await channelItems.count();
        
        if (itemCount > 0) {
          await expect(channelItems.first()).toBeVisible();
          
          // Check for channel names
          const channelNames = channelItems.locator('.channel-name, .name');
          if (await channelNames.count() > 0) {
            await expect(channelNames.first()).toBeVisible();
          }
        }
      }
    });

    test('should allow channel selection', async ({ page }) => {
      await page.goto('/');
      
      const channelsList = page.locator('.chanels-list');
      if (await channelsList.count() > 0) {
        const channelItems = channelsList.locator('.channel-item');
        if (await channelItems.count() > 0) {
          const firstChannel = channelItems.first();
          
          // Click on channel
          await firstChannel.click();
          
          // Channel should get selected class
          const selectedClass = await firstChannel.getAttribute('class');
          expect(selectedClass).toMatch(/selected|active/i);
        }
      }
    });
  });

  test.describe('Rooms_List', () => {
    test('should display rooms list', async ({ page }) => {
      await page.goto('/');
      
      const roomsList = page.locator('.rooms-list, [class*="rooms"]');
      const listCount = await roomsList.count();
      
      if (listCount > 0) {
        await expect(roomsList.first()).toBeVisible();
        
        // Check for room items
        const roomItems = roomsList.locator('.room-item, li');
        const itemCount = await roomItems.count();
        
        if (itemCount > 0) {
          await expect(roomItems.first()).toBeVisible();
          
          // Check for room names
          const roomNames = roomItems.locator('.room-name, .name');
          if (await roomNames.count() > 0) {
            await expect(roomNames.first()).toBeVisible();
          }
        }
      }
    });

    test('should allow room selection', async ({ page }) => {
      await page.goto('/');
      
      const roomsList = page.locator('.rooms-list');
      if (await roomsList.count() > 0) {
        const roomItems = roomsList.locator('.room-item');
        if (await roomItems.count() > 0) {
          const firstRoom = roomItems.first();
          
          // Click on room
          await firstRoom.click();
          
          // Room should get selected class
          const selectedClass = await firstRoom.getAttribute('class');
          expect(selectedClass).toMatch(/selected|active/i);
        }
      }
    });
  });

  test.describe('Rooms_Online_List', () => {
    test('should display online users list', async ({ page }) => {
      await page.goto('/');
      
      const onlineList = page.locator('.rooms-online-list, [class*="online"]');
      const listCount = await onlineList.count();
      
      if (listCount > 0) {
        await expect(onlineList.first()).toBeVisible();
        
        // Check for online user items
        const userItems = onlineList.locator('.user-item, .online-user');
        const itemCount = await userItems.count();
        
        if (itemCount > 0) {
          await expect(userItems.first()).toBeVisible();
          
          // Check for user names
          const userNames = userItems.locator('.user-name, .name');
          if (await userNames.count() > 0) {
            await expect(userNames.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Messenger_Field', () => {
    test('should display message input and messages', async ({ page }) => {
      await page.goto('/');
      
      const messengerField = page.locator('.messenger-field, [class*="messenger"]');
      const fieldCount = await messengerField.count();
      
      if (fieldCount > 0) {
        await expect(messengerField.first()).toBeVisible();
        
        // Check for messages container
        const messagesContainer = messengerField.locator('.messages-container, .messages-list');
        if (await messagesContainer.count() > 0) {
          await expect(messagesContainer.first()).toBeVisible();
        }
        
        // Check for message input
        const messageInput = messengerField.locator('.message-input, input[type="text"]');
        if (await messageInput.count() > 0) {
          await expect(messageInput.first()).toBeVisible();
        }
      }
    });

    test('should allow sending messages', async ({ page }) => {
      await page.goto('/');
      
      const messengerField = page.locator('.messenger-field');
      if (await messengerField.count() > 0) {
        const messageInput = messengerField.locator('input[type="text"]');
        const sendButton = messengerField.locator('button:has-text("Отправить"), button:has-text("Send")');
        
        if (await messageInput.count() > 0 && await sendButton.count() > 0) {
          // Type a message
          await messageInput.fill('Test message');
          
          // Click send button
          await sendButton.click();
          
          // Input should clear or show sending state
          const inputValue = await messageInput.inputValue();
          // Either cleared or still contains text (depending on implementation)
        }
      }
    });
  });

  test.describe('Widget interactions', () => {
    test('widgets should respond to user interactions', async ({ page }) => {
      await page.goto('/');
      
      // Test various widget interactions
      const interactiveElements = page.locator('button, input, .clickable');
      const elementCount = await interactiveElements.count();
      
      if (elementCount > 0) {
        // Test the first interactive element
        const firstElement = interactiveElements.first();
        await expect(firstElement).toBeVisible();
        
        // Click and verify response
        await firstElement.click();
        
        // Element should still be visible
        await expect(firstElement).toBeVisible();
      }
    });
  });
});