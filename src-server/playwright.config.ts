import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Измените на false для последовательного выполнения
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Используйте 1 worker для избежания конфликтов
  reporter: 'html',
  
  use: {
    baseURL: undefined,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'server',
      use: {},
    },
  ],

  timeout: 60000, // Увеличьте таймаут
  expect: {
    timeout: 10000,
  },
});