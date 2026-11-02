import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("真实 WebRTC：登录、音视频、单轨切换、截图录制、参数与计划", async ({
	page,
}) => {
	const password = await readFile(".runtime/e2e/password", "utf8");
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/");
	await page.getByLabel("账号", { exact: true }).fill("admin");
	await page.getByLabel("密码", { exact: true }).fill(password);
	const activity = page.waitForResponse(
		(response) =>
			response.url().endsWith("/api/auth/activity") &&
			response.status() === 204,
	);
	await page.getByRole("button", { name: "进入控制台" }).click();
	await activity;
	await page.getByRole("button", { name: "开始采集", exact: true }).click();
	const media = page.locator("video");
	await expect
		.poll(() =>
			media.evaluate((el) =>
				(el.srcObject as MediaStream | null)
					?.getTracks()
					.map((t) => t.kind)
					.sort()
					.join(","),
			),
		)
		.toBe("audio,video");
	await expect.poll(() => media.evaluate((el) => el.videoWidth)).toBe(1280);
	await expect
		.poll(() => media.evaluate((el) => el.currentTime))
		.toBeGreaterThan(0.5);
	await page.getByRole("button", { name: "开启声音", exact: true }).click();
	await expect(media).toHaveJSProperty("muted", false);
	await expect(
		page.getByRole("button", { name: "静音", exact: true }),
	).toBeVisible();
	const snapshot = page.waitForEvent("download");
	await page.getByRole("button", { name: "截图", exact: true }).click();
	expect((await snapshot).suggestedFilename()).toMatch(/\.png$/);
	await page.getByRole("button", { name: "本地录制", exact: true }).click();
	await expect(page.getByText("本地录制中", { exact: true })).toBeVisible();
	await expect
		.poll(() => media.evaluate((el) => el.currentTime))
		.toBeGreaterThan(2);
	const recording = page.waitForEvent("download");
	await page.getByRole("button", { name: "停止录制", exact: true }).click();
	expect((await recording).suggestedFilename()).toMatch(/\.(webm|mp4)$/);
	await page.getByRole("button", { name: "仅音频", exact: true }).click();
	await expect
		.poll(() =>
			media.evaluate((el) =>
				(el.srcObject as MediaStream | null)
					?.getTracks()
					.map((t) => t.kind)
					.join(","),
			),
		)
		.toBe("audio");
	await expect(
		page.getByRole("heading", { name: "仅音频", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "仅视频", exact: true }).click();
	await expect
		.poll(() =>
			media.evaluate((el) =>
				(el.srcObject as MediaStream | null)
					?.getTracks()
					.map((t) => t.kind)
					.join(","),
			),
		)
		.toBe("video");
	await expect(
		page.getByRole("button", { name: "静音", exact: true }),
	).toBeDisabled();
	await page.getByRole("button", { name: "音视频", exact: true }).click();
	await expect
		.poll(() =>
			media.evaluate(
				(el) => (el.srcObject as MediaStream | null)?.getTracks().length,
			),
		)
		.toBe(2);
	await expect.poll(() => media.evaluate((el) => el.videoWidth)).toBe(1280);
	await expect
		.poll(() => media.evaluate((el) => el.currentTime))
		.toBeGreaterThan(0.5);
	await page.screenshot({ path: ".runtime/qa-monitor-desktop.png" });
	await page.getByRole("button", { name: "暂停此设备观看" }).click();
	await expect(
		page.getByRole("button", { name: "恢复观看", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "恢复观看", exact: true }).click();
	await expect.poll(() => media.evaluate((el) => el.videoWidth)).toBe(1280);
	await page.getByRole("link", { name: "采集参数", exact: true }).click();
	await page.getByLabel("目标帧率 / FPS", { exact: true }).fill("25");
	await page.getByRole("button", { name: "保存并应用", exact: true }).click();
	await expect(
		page.getByText("配置已保存并应用", { exact: true }),
	).toBeVisible();
	await page.getByRole("link", { name: "定时计划", exact: true }).click();
	await page.getByRole("button", { name: /按计划开放/ }).click();
	await page.getByRole("button", { name: "保存并应用", exact: true }).click();
	await page.getByRole("link", { name: "实时监看", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "开始采集", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "隐私模式 - 采集已关闭" }),
	).toBeVisible();
	await page.getByRole("link", { name: "定时计划", exact: true }).click();
	await page.getByRole("button", { name: "添加开放时段" }).click();
	await page.getByLabel("开始时间", { exact: true }).fill("22:00");
	await page.getByLabel("结束时间", { exact: true }).fill("06:00");
	await expect(page.getByText("次日结束", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "保存并应用", exact: true }).click();
	await page.screenshot({ path: ".runtime/qa-schedules-desktop.png" });
	await page.getByRole("link", { name: "实时监看", exact: true }).click();
	if (
		await page
			.getByRole("button", { name: "隐私停止", exact: true })
			.isVisible()
	)
		await page.getByRole("button", { name: "隐私停止", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "开始采集", exact: true }),
	).toBeVisible();
	expect(errors).toEqual([]);
});

test("访客授权隔离与八种界面语言", async ({ page, browser }) => {
	const password = await readFile(".runtime/e2e/password", "utf8");
	await page.goto("/");
	await page.getByLabel("账号", { exact: true }).fill("admin");
	await page.getByLabel("密码", { exact: true }).fill(password);
	await page.getByRole("button", { name: "进入控制台" }).click();
	await page.getByRole("link", { name: "访问安全", exact: true }).click();
	await page.getByRole("switch", { name: /允许访客登录/ }).check();
	await page.getByLabel("设置新的访客密码", { exact: false }).fill(password);
	await page.getByRole("button", { name: "设置访客密码并开放" }).click();
	await expect(
		page.getByText("访客密码已更新，原有访客会话已结束", { exact: true }),
	).toBeVisible();
	const viewer = await browser.newContext({
		viewport: { width: 390, height: 844 },
		locale: "zh-CN",
	});
	const mobile = await viewer.newPage();
	await mobile.goto("http://127.0.0.1:13210/");
	await mobile.getByLabel("账号", { exact: true }).fill("viewer");
	await mobile.getByLabel("密码", { exact: true }).fill(password);
	await mobile.getByRole("button", { name: "进入控制台" }).click();
	await expect(
		mobile.getByRole("heading", { name: "实时监看", exact: true }),
	).toBeVisible();
	expect(
		(await viewer.request.get("http://127.0.0.1:13210/api/config")).status(),
	).toBe(403);
	await mobile.screenshot({ path: ".runtime/qa-monitor-mobile.png" });
	expect(
		await mobile.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth,
		),
	).toBe(false);
	await page.getByRole("button", { name: "刷新设备列表" }).click();
	await page
		.locator(".session-row")
		.filter({ hasText: "只读访客" })
		.getByRole("button", { name: "结束会话" })
		.click();
	await expect(
		mobile.getByRole("button", { name: "进入控制台" }),
	).toBeVisible();
	for (const code of ["zh-TW", "en", "ja", "ko", "es", "fr", "de", "zh-CN"]) {
		const dictionary = JSON.parse(
			await readFile(`apps/web/src/locales/${code}.json`, "utf8"),
		);
		const label = dictionary["登录"];
		await mobile.locator(".preferences-trigger").click();
		await mobile.locator(".language-switch select").selectOption(code!);
		await mobile.locator(".preferences-dialog .icon-button").click();
		await expect(
			mobile.getByRole("heading", { name: label!, exact: true }),
		).toBeVisible();
		await expect(mobile.locator("html")).toHaveAttribute("lang", code!);
		const font =
			(
				{
					"zh-CN": "Noto Sans SC Variable",
					"zh-TW": "Noto Sans TC Variable",
					ja: "Noto Sans JP Variable",
					ko: "Noto Sans KR Variable",
				} as Record<string, string>
			)[code] ?? "DM Sans Variable";
		await expect
			.poll(() =>
				mobile.evaluate(
					(family) =>
						[...document.fonts].some(
							(face) =>
								face.family.includes(family) && face.status === "loaded",
						),
					font,
				),
			)
			.toBe(true);
		expect(
			await mobile.evaluate(
				() => document.documentElement.scrollWidth > window.innerWidth,
			),
		).toBe(false);
	}
	await viewer.close();
});
