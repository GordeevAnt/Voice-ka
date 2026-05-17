import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for server (WebSocket) tests
 * These tests connect directly to the Rust WebSocket server on port 9001
 * 
 * IMPORTANT: The Rust server must be running before executing these tests.
 * Start it with: cargo run server (from src-server directory)
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* No baseURL needed for WebSocket tests */
    baseURL: undefined,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Screenshot on failure - not applicable for WebSocket tests but kept for consistency */
    screenshot: 'only-on-failure',
  },

  /* Configure projects - we don't need browsers for WebSocket tests */
  projects: [
    {
      name: 'server',
      use: { 
        /* No browser needed */
      },
    },
  ],

  /* Global timeout for each test */
  timeout: 30 * 1000,
  
  /* Expect timeout */
  expect: {
    timeout: 5000,
  },
});