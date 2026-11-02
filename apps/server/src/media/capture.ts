import { type ChildProcess, spawn } from "node:child_process";
import { hostname, networkInterfaces } from "node:os";
import {
	nextTransition,
	type RuntimeStatus,
	shouldCapture,
} from "@lanvoryn/shared";
import { env } from "../environment.js";
import type { Store } from "../storage.js";
import { ffmpegArgs } from "./ffmpeg.js";
import { PlaybackDemand } from "./playback-demand.js";

export class Capture {
	private child: ChildProcess | null = null;
	private generation = 0;
	private retry: ReturnType<typeof setTimeout> | undefined;
	private watchdog: ReturnType<typeof setTimeout> | undefined;
	private signature = "";
	private serial = Promise.resolve();
	private state: RuntimeStatus["state"] = "stopped";
	private since: string | null = null;
	private error: string | null = null;
	private restarts = 0;
	private failures = 0;
	private logs: string[] = [];
	private nextCache: { key: string; value: RuntimeStatus["next"] } | undefined;

	readonly demand = new PlaybackDemand();
	private inputs = { video: false, audio: false };
	constructor(private store: Store) {}

	private effectiveConfig() {
		const config = structuredClone(this.store.document.config);
		const wanted = this.demand.inputs;
		config.video.enabled &&= wanted.video;
		config.audio.enabled &&= wanted.audio;
		return config;
	}

	reconcile(force = false) {
		const task = this.serial.then(() => this.apply(force));
		this.serial = task.catch(() => {});
		return task;
	}

	private async apply(force: boolean) {
		const config = this.effectiveConfig();
		if (
			!shouldCapture(config.capture) ||
			(!config.video.enabled && !config.audio.enabled)
		) {
			if (this.child || this.retry) await this.stop();
			this.state = "stopped";
			this.error = null;
			return;
		}
		const signature = JSON.stringify([config.video, config.audio]);
		if (!force && this.signature === signature && (this.child || this.retry))
			return;
		await this.stop();
		this.signature = signature;
		this.failures = 0;
		this.launch();
	}

	private launch() {
		const config = this.effectiveConfig();
		if (
			!shouldCapture(config.capture) ||
			(!config.video.enabled && !config.audio.enabled)
		)
			return;
		this.inputs = { video: config.video.enabled, audio: config.audio.enabled };
		this.logs = [];
		const generation = ++this.generation;
		const child = spawn(
			env.LANVORYN_FFMPEG,
			ffmpegArgs(config, env.LANVORYN_SOURCE, env.LANVORYN_RTSP_URL),
			{ stdio: ["ignore", "pipe", "pipe"], shell: false },
		);
		this.child = child;
		this.state = "starting";
		this.since = new Date().toISOString();
		this.store.event(
			"info",
			env.LANVORYN_SOURCE === "demo"
				? "启动合成测试音视频采集"
				: "启动设备音视频采集",
		);
		this.watchdog = setTimeout(() => {
			this.logs.push(
				"启动 20 秒后仍未收到编码进度，请检查 MediaMTX、设备占用和硬件编码支持。",
			);
			child.kill("SIGKILL");
		}, 20000);
		child.stdout?.on("data", (data) => {
			if (generation !== this.generation) return;
			if (String(data).includes("progress=")) {
				this.state = "running";
				this.error = null;
				this.failures = 0;
				clearTimeout(this.watchdog);
			}
		});
		child.stderr?.on("data", (data) => {
			const lines = String(data).split("\n").filter(Boolean);
			this.logs.push(...lines);
			this.logs = this.logs.slice(-40);
		});
		child.on("error", (error) => this.logs.push(error.message));
		child.on("close", (code) => {
			if (generation !== this.generation) return;
			clearTimeout(this.watchdog);
			this.child = null;
			this.inputs = { video: false, audio: false };
			this.error = this.logs.slice(-6).join("\n") || `FFmpeg 已退出（${code}）`;
			this.store.event("error", this.error);
			if (shouldCapture(this.store.document.config.capture)) {
				this.state = "retrying";
				this.restarts++;
				const delay = Math.min(30000, 2000 * 2 ** Math.min(this.failures++, 4));
				this.retry = setTimeout(() => {
					this.retry = undefined;
					this.launch();
				}, delay);
			} else this.state = "stopped";
		});
	}

	async stop() {
		++this.generation;
		clearTimeout(this.retry);
		clearTimeout(this.watchdog);
		this.retry = undefined;
		const child = this.child;
		this.child = null;
		if (child && child.exitCode === null && child.signalCode === null) {
			await new Promise<void>((resolve) => {
				const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
				child.once("close", () => {
					clearTimeout(timeout);
					resolve();
				});
				child.kill("SIGTERM");
			});
			this.store.event("info", "采集已停止，摄像头和麦克风已释放");
		}
		this.state = "stopped";
		this.inputs = { video: false, audio: false };
		this.since = null;
	}

	async status(viewers: number): Promise<RuntimeStatus> {
		let mediaOnline = false;
		let streamReady = false;
		try {
			const response = await fetch(
				`${env.LANVORYN_MEDIAMTX_API}/v3/paths/get/live`,
				{ signal: AbortSignal.timeout(1500) },
			);
			mediaOnline = response.ok || response.status === 404;
			if (response.ok)
				streamReady = ((await response.json()) as { ready: boolean }).ready;
		} catch {
			/* 在状态界面明确展示 MediaMTX 不可用，不伪造在线状态。 */
		}
		const { config } = this.store.document;
		const key = `${this.store.document.revision}:${Math.floor(Date.now() / 60000)}`;
		if (this.nextCache?.key !== key)
			this.nextCache = { key, value: nextTransition(config.capture) };
		return {
			state: this.state,
			desired: shouldCapture(config.capture),
			source: env.LANVORYN_SOURCE,
			capturing: this.inputs,
			since: this.since,
			pid: this.child?.pid ?? null,
			restarts: this.restarts,
			error: this.error,
			mediaOnline,
			streamReady,
			viewers,
			hostname: hostname(),
			addresses: env.LANVORYN_PUBLIC_ORIGIN
				? [env.LANVORYN_PUBLIC_ORIGIN]
				: env.LANVORYN_HOST === "127.0.0.1"
					? [`http://127.0.0.1:${env.LANVORYN_PORT}`]
					: Object.values(networkInterfaces())
							.flatMap((list) => list ?? [])
							.filter((item) => !item.internal && item.family === "IPv4")
							.map((item) => `http://${item.address}:${env.LANVORYN_PORT}`),
			next: this.nextCache?.value ?? null,
			video: config.video,
			audio: config.audio,
			name: config.name,
			policy: config.capture.policy,
			timezone: config.capture.timezone,
			serverTime: new Date().toISOString(),
		};
	}
}
