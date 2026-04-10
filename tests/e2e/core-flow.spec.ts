import { test, expect } from '@playwright/test';

test.describe('Unified Messaging Core Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Auth
    await page.route('**/api/auth/me', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 1, username: 'testuser' } }) });
    });
    await page.route('**/api/auth/register', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'fake-token', user: { id: 1, username: 'testuser' } }) });
    });
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'fake-token', user: { id: 1, username: 'testuser' } }) });
    });

    // Mock Telegram
    await page.route('**/api/telegram/chats', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ chats: [{ id: '101', title: 'Alice Smith', type: 'private' }] }) });
    });
    await page.route('**/api/telegram/chats/101/messages', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [{ id: 'm1', chatId: '101', text: 'Hello from Telegram!', sender: 'other', senderName: 'Alice Smith', timestamp: new Date().toISOString(), platform: 'telegram' }] }) });
    });
    await page.route('**/api/telegram/messages', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    // Mock Email
    await page.route('**/api/email/chats', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ chats: [{ id: 'alice@example.com', title: 'Alice Smith', email: 'alice@example.com' }] }) });
    });
    await page.route('**/api/email/chats/alice@example.com/messages', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [{ id: 'm2', chatId: 'alice@example.com', text: 'Hello from Email!', subject: 'Greetings', sender: 'other', senderName: 'Alice Smith', timestamp: new Date(Date.now() - 10000).toISOString(), platform: 'email' }] }) });
    });
    await page.route('**/api/email/messages', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    // Gracefully handle WhatsApp and Signal if they make requests we haven't mocked
    await page.route('**/api/**', async route => {
      if (!route.request().url().includes('/api/auth') && 
          !route.request().url().includes('/api/telegram') && 
          !route.request().url().includes('/api/email')) {
        await route.fulfill({ status: 200, body: '{}' });
      } else {
        await route.fallback();
      }
    });
  });

  test('should login, load contacts, merge contacts, switch streams, and send messages', async ({ page }) => {
    // 1. Logging in
    await page.goto('/login');
    await page.getByLabel('Username').fill('testuser');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();

    // Verify successful login
    await expect(page.getByText('Merge', { exact: true })).toBeVisible({ timeout: 10000 });
    
    // 2. Load contacts & check merging
    // "Alice Smith" should appear as a single merged contact because of matching names.
    const aliceContact = page.locator('li').filter({ hasText: 'Alice Smith' });
    await expect(aliceContact).toBeVisible({ timeout: 10000 });
    
    // Check that she has both Telegram and Email icons (represented by colors, but we can just check the platforms string internally, or just click it)
    await aliceContact.click();

    // 3. Check Messages
    // Should see messages from both Telegram and Email in the stream
    await expect(page.getByText('Hello from Telegram!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Hello from Email!')).toBeVisible({ timeout: 10000 });

    // 4. Send a message
    // Type in the composer
    const composerInput = page.locator('.rich-editor');
    await composerInput.fill('Reply to Alice');

    // Switch platform dropdown if needed to send specifically, or just press send (defaults to the first active platform or something similar in this app)
    // There's usually a send button or Enter
    await composerInput.press('Enter');

    // We should see the sent message in the stream locally
    await expect(page.getByText('Reply to Alice')).toBeVisible({ timeout: 10000 });
  });
});