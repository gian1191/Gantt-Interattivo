import { defineConfig, devices } from '@playwright/test';

/**
 * Configurazione Playwright per i test end-to-end del Gantt interattivo.
 * Documentazione: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox e WebKit: da abilitare dopo `npx playwright install firefox webkit`.
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // Nessun webServer: l'applicazione e' un file singolo, i test la aprono via file://.
});
