import { defineConfig, devices } from '@playwright/test';

const MOCK_BACKEND_URL = 'http://localhost:40099';
const FRONTEND_URL = 'http://localhost:30099';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // All specs share one in-memory mock-backend (e2e/mock-backend.js) — it
  // has no per-test isolation beyond the beforeEach reset, so different
  // spec files running concurrently in separate workers race on that
  // shared state (seen directly: flaky failures that vanished once forced
  // serial). Keep this at 1 unless the mock backend gets real per-worker
  // isolation.
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node e2e/mock-backend.js',
      url: `${MOCK_BACKEND_URL}/health`,
      env: { MOCK_BACKEND_PORT: '40099' },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm run dev:e2e',
      url: FRONTEND_URL,
      env: {
        PORT: '30099',
        PLAYWRIGHT_E2E: '1',
        KNOWLEDGE_STORE_URL: MOCK_BACKEND_URL,
        ORCHESTRATOR_URL: MOCK_BACKEND_URL,
        KEY_ALLOWED_AGENTS: 'test-key',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
