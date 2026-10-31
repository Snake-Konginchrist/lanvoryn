import { resolve } from "node:path";
import { z } from "zod";

const localUrl = z
	.string()
	.url()
	.refine((value) => {
		const url = new URL(value);
		return ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname);
	}, "MediaMTX 管理和发布地址必须位于回环接口");

const schema = z.object({
	LANVORYN_HOST: z.string().default("0.0.0.0"),
	LANVORYN_PORT: z.coerce.number().int().min(1024).max(65535).default(3210),
	LANVORYN_DATA_DIR: z.string().default("./data"),
	LANVORYN_SOURCE: z.enum(["linux", "demo"]).default("linux"),
	LANVORYN_FFMPEG: z.string().default("ffmpeg"),
	LANVORYN_V4L2_CTL: z.string().default("v4l2-ctl"),
	LANVORYN_MEDIAMTX_WEBRTC: localUrl.default("http://127.0.0.1:8889"),
	LANVORYN_MEDIAMTX_API: localUrl.default("http://127.0.0.1:9997"),
	LANVORYN_RTSP_URL: localUrl.default("rtsp://127.0.0.1:8554/live"),
	LANVORYN_SESSION_HOURS: z.coerce.number().min(0.1).max(168).default(12),
	LANVORYN_SECURE_COOKIE: z.enum(["true", "false"]).default("false"),
	LANVORYN_PUBLIC_ORIGIN: z.string().default(""),
	LANVORYN_IP_GEOLOCATION: z.enum(["true", "false"]).default("true"),
	LANVORYN_ALLOWED_CIDRS: z.string().default(""),
});

export const env = schema.parse(process.env);
export const dataDir = resolve(env.LANVORYN_DATA_DIR);
