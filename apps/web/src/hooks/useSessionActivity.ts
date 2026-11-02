import { useEffect } from "react";
import { api } from "../api";

// 只记录打开页面、返回前台或真实输入；后台状态轮询不续期。
export function useSessionActivity(enabled: boolean) {
	useEffect(() => {
		if (!enabled) return;
		let lastSent = 0;
		let pending = false;
		const record = async () => {
			if (
				document.visibilityState !== "visible" ||
				pending ||
				Date.now() - lastSent < 60000
			)
				return;
			pending = true;
			lastSent = Date.now();
			try {
				await api("/auth/activity", { method: "POST" });
			} catch {
				// 过期由统一认证处理；临时网络故障等待下一次操作再试。
			} finally {
				pending = false;
			}
		};
		const interact = (event: Event) => {
			if (event.isTrusted) void record();
		};
		const visible = () => {
			void record();
		};
		document.addEventListener("pointerdown", interact, { passive: true });
		document.addEventListener("keydown", interact);
		document.addEventListener("wheel", interact, { passive: true });
		document.addEventListener("visibilitychange", visible);
		window.addEventListener("focus", visible);
		void record();
		return () => {
			document.removeEventListener("pointerdown", interact);
			document.removeEventListener("keydown", interact);
			document.removeEventListener("wheel", interact);
			document.removeEventListener("visibilitychange", visible);
			window.removeEventListener("focus", visible);
		};
	}, [enabled]);
}
