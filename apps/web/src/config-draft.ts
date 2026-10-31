import type { AppConfig } from "@lanvoryn/shared";

// 保存期间继续编辑的草稿不能被较早的请求结果覆盖。
export function afterSave(
	current: AppConfig | null,
	submitted: AppConfig,
	persisted: AppConfig,
): AppConfig {
	return JSON.stringify(current) === JSON.stringify(submitted) || !current
		? structuredClone(persisted)
		: current;
}

// 即时控制只更新控制状态，保留未保存的时区和每周时段。
export function afterControl(
	current: AppConfig | null,
	persisted: AppConfig,
	action: "start" | "stop" | "restart",
): AppConfig {
	if (!current) return structuredClone(persisted);
	if (action === "restart") return current;
	return {
		...current,
		capture: {
			...current.capture,
			policy: persisted.capture.policy,
			manualEnabled: persisted.capture.manualEnabled,
		},
	};
}
