import type { AppConfig } from "./config.js";

function localParts(now: Date, timezone: string) {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: timezone,
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now);
	const part = (type: string) =>
		parts.find((p) => p.type === type)?.value ?? "";
	const day =
		["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(part("weekday")) +
		1;
	return { day, minute: Number(part("hour")) * 60 + Number(part("minute")) };
}

const minutes = (value: string) =>
	Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

/** 跨午夜窗口属于开始日；重启或时钟跳变后，根据当前时间重新计算。 */
export function shouldCapture(
	capture: AppConfig["capture"],
	now = new Date(),
): boolean {
	if (capture.policy === "always") return true;
	if (capture.policy === "manual") return capture.manualEnabled;
	const { day, minute } = localParts(now, capture.timezone);
	return capture.windows.some((window) => {
		const start = minutes(window.start);
		const end = minutes(window.end);
		if (start < end)
			return window.days.includes(day) && minute >= start && minute < end;
		const previousDay = day === 1 ? 7 : day - 1;
		return (
			(window.days.includes(day) && minute >= start) ||
			(window.days.includes(previousDay) && minute < end)
		);
	});
}

export function nextTransition(
	capture: AppConfig["capture"],
	now = new Date(),
) {
	if (capture.policy !== "schedule" || capture.windows.length === 0)
		return null;
	const initial = shouldCapture(capture, now);
	const first = Math.floor(now.getTime() / 60000) * 60000 + 60000;
	for (let i = 0; i <= 8 * 24 * 60; i++) {
		const at = new Date(first + i * 60000);
		const enabled = shouldCapture(capture, at);
		if (enabled !== initial) return { at: at.toISOString(), enabled };
	}
	return null;
}
