import { defineConfig, devices } from '@playwright/test';

/**
 * RE² Playwright E2E Configuration
 * Runs against the local dev server (localhost:5173)
 * All tests use Chromium only for now — add Firefox/WebKit later
 *
 * Run:         npx playwright test
 * UI Mode:     npx playwright test --ui
 * Single file: npx playwright test e2e/playwright_test_04142026_maya.spec.ts
 */
export default defineConfig({
	testDir: './e2e',
	/* Run tests in parallel */
	fullyParallel: false,
	/* Fail the build on CI if you accidentally left test.only in source code */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Reporter — save results to Testing folder */
	reporter: [
		['list'],
		['html', { outputFolder: 'C:/sandbox_re_squared/Testing/playwright-report', open: 'never' }],
		['json', { outputFile: 'C:/sandbox_re_squared/Testing/playwright-results-04142026.json' }],
	],
	use: {
		/* Base URL for all tests */
		baseURL: 'http://localhost:5173',
		/* Capture screenshot on failure */
		screenshot: 'only-on-failure',
		/* Record video on failure */
		video: 'retain-on-failure',
		/* Collect trace on failure for debugging */
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	/* Dev server automatically managed by Playwright */
	webServer: {
		command: 'npm run dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		stdout: 'pipe',
		stderr: 'pipe'
	},
});
