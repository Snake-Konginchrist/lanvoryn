import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const device = z
	.string()
	.min(1)
	.max(300)
	.regex(/^\/dev\/(video\d+|v4l\/by-id\/[\w.:-]+)$/);
const windowSchema = z
	.object({
		id: z.string().uuid(),
		days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
		start: time,
		end: time,
	})
	.strict()
	.refine((v) => v.start !== v.end, "开始和结束时间不能相同");

export const configSchema = z
	.object({
		name: z.string().trim().min(1).max(48),
		video: z
			.object({
				enabled: z.boolean(),
				device,
				inputFormat: z.enum(["mjpeg", "yuyv422"]),
				width: z
					.number()
					.int()
					.min(160)
					.max(7680)
					.refine((v) => v % 2 === 0, "宽度必须是偶数"),
				height: z
					.number()
					.int()
					.min(120)
					.max(4320)
					.refine((v) => v % 2 === 0, "高度必须是偶数"),
				fps: z.number().int().min(1).max(120),
				bitrateKbps: z.number().int().min(256).max(50000),
				encoder: z.enum(["libx264", "h264_nvenc"]),
				keyframeSeconds: z.number().int().min(1).max(5),
				rotation: z.enum(["0", "90", "180", "270"]),
				mirror: z.boolean(),
			})
			.strict(),
		audio: z
			.object({
				enabled: z.boolean(),
				device: z
					.string()
					.min(1)
					.max(120)
					.regex(/^(?:plug)?hw:[A-Za-z0-9_-]+,\d+$/),
				sampleRate: z.enum(["16000", "32000", "48000"]),
				channels: z.union([z.literal(1), z.literal(2)]),
				bitrateKbps: z.number().int().min(16).max(256),
				gainDb: z.number().min(-30).max(20),
				noiseSuppression: z.boolean(),
				highpass: z.boolean(),
				offsetMs: z.number().int().min(-2000).max(2000),
			})
			.strict(),
		capture: z
			.object({
				policy: z.enum(["manual", "always", "schedule"]),
				manualEnabled: z.boolean(),
				timezone: z
					.string()
					.max(80)
					.refine((value) => {
						try {
							new Intl.DateTimeFormat("en", { timeZone: value });
							return true;
						} catch {
							return false;
						}
					}, "无效的 IANA 时区"),
				windows: z.array(windowSchema).max(32),
			})
			.strict(),
	})
	.strict()
	.refine((v) => v.video.enabled || v.audio.enabled, "至少启用一种采集输入");

export type AppConfig = z.infer<typeof configSchema>;
export type ScheduleWindow = AppConfig["capture"]["windows"][number];
export type PlaybackMode = "av" | "video" | "audio";
export type Role = "admin" | "viewer";

export const defaultConfig: AppConfig = {
	name: "我的局域网现场",
	video: {
		enabled: true,
		device: "/dev/video0",
		inputFormat: "mjpeg",
		width: 1920,
		height: 1080,
		fps: 30,
		bitrateKbps: 4000,
		encoder: "libx264",
		keyframeSeconds: 1,
		rotation: "0",
		mirror: false,
	},
	audio: {
		enabled: true,
		device: "plughw:Camera,0",
		sampleRate: "48000",
		channels: 2,
		bitrateKbps: 96,
		gainDb: 0,
		noiseSuppression: false,
		highpass: false,
		offsetMs: 0,
	},
	capture: {
		policy: "manual",
		manualEnabled: false,
		timezone: "Asia/Shanghai",
		windows: [],
	},
};

export const presets = {
	fluent: { width: 1280, height: 720, fps: 25, bitrateKbps: 1800 },
	balanced: { width: 1920, height: 1080, fps: 30, bitrateKbps: 4000 },
	detailed: { width: 3840, height: 2160, fps: 30, bitrateKbps: 12000 },
} as const;
