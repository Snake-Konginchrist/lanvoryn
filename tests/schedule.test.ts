import assert from "node:assert/strict";
import { test } from "node:test";
import {
	configSchema,
	defaultConfig,
	nextTransition,
	shouldCapture,
} from "@lanvoryn/shared";

const plan = () => ({
	...structuredClone(defaultConfig.capture),
	policy: "schedule" as const,
});
const id = "4d1b6709-c27c-4550-95bf-b4aba8b30a19";

test("上海时区工作日窗口包含开始时间、不包含结束时间", () => {
	const capture = plan();
	capture.windows = [{ id, days: [1], start: "09:00", end: "18:00" }];
	assert.equal(shouldCapture(capture, new Date("2026-11-02T00:59:59Z")), false);
	assert.equal(shouldCapture(capture, new Date("2026-11-02T01:00:00Z")), true);
	assert.equal(shouldCapture(capture, new Date("2026-11-02T10:00:00Z")), false);
	assert.equal(shouldCapture(capture, new Date("2026-11-03T01:00:00Z")), false);
});
test("周日跨午夜窗口正确延伸到下周一", () => {
	const capture = plan();
	capture.windows = [{ id, days: [7], start: "22:00", end: "06:00" }];
	assert.equal(shouldCapture(capture, new Date("2026-11-01T13:59:00Z")), false);
	assert.equal(shouldCapture(capture, new Date("2026-11-01T14:00:00Z")), true);
	assert.equal(shouldCapture(capture, new Date("2026-11-01T21:59:00Z")), true);
	assert.equal(shouldCapture(capture, new Date("2026-11-01T22:00:00Z")), false);
});
test("窗口重叠不导致提前停止，空计划保持关闭", () => {
	const capture = plan();
	assert.equal(shouldCapture(capture), false);
	capture.windows = [
		{ id, days: [1], start: "09:00", end: "12:00" },
		{ id, days: [1], start: "11:00", end: "14:00" },
	];
	assert.equal(shouldCapture(capture, new Date("2026-11-02T04:00:00Z")), true);
	assert.equal(
		nextTransition(capture, new Date("2026-11-02T04:00:00Z"))?.at,
		"2026-11-02T06:00:00.000Z",
	);
});
test("夏令时跳过不存在的本地时间，按实际本地时间恢复状态", () => {
	const capture = {
		...plan(),
		timezone: "America/New_York",
		windows: [{ id, days: [7], start: "02:30", end: "04:00" }],
	};
	assert.equal(shouldCapture(capture, new Date("2026-03-08T06:59:00Z")), false);
	assert.equal(shouldCapture(capture, new Date("2026-03-08T07:00:00Z")), true);
	assert.equal(shouldCapture(capture, new Date("2026-03-08T08:00:00Z")), false);
});
test("拒绝两个采集输入同时关闭、奇数尺寸、非法设备和无效时区", () => {
	for (const mutate of [
		(c: typeof defaultConfig) => {
			c.video.enabled = false;
			c.audio.enabled = false;
		},
		(c: typeof defaultConfig) => {
			c.video.width = 1921;
		},
		(c: typeof defaultConfig) => {
			c.video.device = "/etc/passwd";
		},
		(c: typeof defaultConfig) => {
			c.audio.device = "hw:0; touch /tmp/bad";
		},
		(c: typeof defaultConfig) => {
			c.capture.timezone = "Mars/Crater";
		},
	]) {
		const config = structuredClone(defaultConfig);
		mutate(config);
		assert.equal(configSchema.safeParse(config).success, false);
	}
});
