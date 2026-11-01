import type { PlaybackMode } from "@lanvoryn/shared";
import { useEffect, useState } from "react";
import { t } from "../i18n";

// HTTP 局域网也能使用；不依赖仅安全上下文提供的 randomUUID。
function randomId() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6]! & 15) | 64;
	bytes[8] = (bytes[8]! & 63) | 128;
	const hex = [...bytes]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function usePlaybackDemand(mode: PlaybackMode, active: boolean) {
	const [lease, setLease] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		setLease(null);
		setError(null);
		if (!active) return;
		const id = randomId();
		const url = `/api/playback/${id}`;
		const controller = new AbortController();
		let timer: ReturnType<typeof setTimeout>;
		let hidden = false;
		const release = () => {
			clearTimeout(timer);
			setLease(null);
			void fetch(url, {
				method: "DELETE",
				headers: { "X-Lanvoryn-Request": "1" },
				keepalive: true,
			}).catch(() => {});
		};
		const renew = async () => {
			try {
				const response = await fetch(url, {
					method: "PUT",
					signal: controller.signal,
					headers: {
						"Content-Type": "application/json",
						"X-Lanvoryn-Request": "1",
					},
					body: JSON.stringify({ mode }),
				});
				if (!response.ok) {
					if (response.status === 401)
						window.dispatchEvent(new Event("lanvoryn:unauthorized"));
					throw new Error(
						t("播放连接失败（{{status}}）", { status: response.status }),
					);
				}
				if (!controller.signal.aborted && !hidden) {
					setLease(id);
					setError(null);
				}
			} catch (cause) {
				if (!controller.signal.aborted && !hidden) {
					setLease(null);
					setError(cause instanceof Error ? cause.message : t("播放失败"));
				}
			} finally {
				if (!controller.signal.aborted && !hidden)
					timer = setTimeout(() => {
						void renew();
					}, 10000);
			}
		};
		const hide = () => {
			hidden = true;
			release();
		};
		const show = (event: PageTransitionEvent) => {
			if (event.persisted) {
				hidden = false;
				void renew();
			}
		};
		window.addEventListener("pagehide", hide);
		window.addEventListener("pageshow", show);
		void renew();
		return () => {
			controller.abort();
			window.removeEventListener("pagehide", hide);
			window.removeEventListener("pageshow", show);
			release();
		};
	}, [mode, active]);
	return { lease, error };
}
