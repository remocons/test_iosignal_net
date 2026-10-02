import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 20000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:18080', headless: true, launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {} },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:18080', reuseExistingServer: false, env: { PORT:'18080', WS_PORT:'17777', TCP_PORT:'55489' } }
});
