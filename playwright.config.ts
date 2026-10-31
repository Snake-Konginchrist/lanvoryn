import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	workers: 1,
	fullyParallel: false,
	timeout: 90000,
	expect: { timeout: 20000 },
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:13210",
		viewport: { width: 1440, height: 1000 },
		locale: "zh-CN",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: {
		command: "node scripts/test-stack.mjs",
		url: "http://127.0.0.1:13210/api/health",
		timeout: 30000,
		reuseExistingServer: false,
	},
});
