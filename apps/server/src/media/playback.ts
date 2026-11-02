import { setTimeout as delay } from "node:timers/promises";
import { type PlaybackMode, shouldCapture } from "@lanvoryn/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../environment.js";
import type { Auth } from "../security/auth.js";
import type { Store } from "../storage.js";
import type { Capture } from "./capture.js";

const denied = () =>
	Object.assign(new Error("采集已停止"), { statusCode: 409 });
const idSchema = z.string().uuid();

export function playbackRoutes(
	app: FastifyInstance,
	auth: Auth,
	capture: Capture,
	store: Store,
) {
	app.put(
		"/api/playback/:id",
		{ preHandler: auth.require },
		async (request, reply) => {
			const id = idSchema.parse((request.params as { id: string }).id);
			const { mode } = z
				.object({ mode: z.enum(["av", "video", "audio"]) })
				.strict()
				.parse(request.body);
			if (!shouldCapture(store.document.config.capture)) throw denied();
			const config = store.document.config;
			if (
				(mode === "video" && !config.video.enabled) ||
				(mode === "audio" && !config.audio.enabled)
			)
				throw denied();
			if (!capture.demand.renew(id, request.session!.id, mode))
				throw Object.assign(new Error("播放会话已达上限，请关闭其他播放页面"), {
					statusCode: 429,
				});
			await capture.reconcile();
			if (!(await auth.touch(request, reply)))
				return reply.code(401).send({ message: "请先登录" });
			return { ok: true };
		},
	);
	app.delete(
		"/api/playback/:id",
		{ preHandler: auth.require },
		async (request, reply) => {
			const id = idSchema.parse((request.params as { id: string }).id);
			capture.demand.remove(id, request.session!.id);
			await capture.reconcile();
			return reply.code(204).send();
		},
	);
}

/** 先确认真实流和所需轨道就绪，再做 WHEP 协商；不以虚假的在线状态触发采集。 */
export async function preparePlayback(
	capture: Capture,
	store: Store,
	id: string,
	owner: string,
	sdp: string,
) {
	const mode = capture.demand.mode(id, owner);
	if (!mode) throw denied();
	const media = [...sdp.matchAll(/^m=(audio|video) ([1-9]\d*) /gm)].map(
		(m) => m[1],
	);
	if (
		!media.length ||
		(mode === "video" && media.includes("audio")) ||
		(mode === "audio" && media.includes("video"))
	)
		throw Object.assign(new Error("操作失败"), { statusCode: 400 });
	const required = (mode: PlaybackMode) => {
		const { video, audio } = store.document.config;
		return [
			mode !== "audio" && video.enabled ? "H264" : "",
			mode !== "video" && audio.enabled ? "Opus" : "",
		].filter(Boolean);
	};
	const deadline = Date.now() + 10000;
	while (Date.now() < deadline) {
		if (
			!capture.demand.has(id, owner) ||
			!shouldCapture(store.document.config.capture)
		)
			throw denied();
		try {
			const response = await fetch(
				`${env.LANVORYN_MEDIAMTX_API}/v3/paths/get/live`,
				{ signal: AbortSignal.timeout(1200) },
			);
			if (response.ok) {
				const stream = (await response.json()) as {
					ready: boolean;
					tracks: string[];
				};
				if (
					stream.ready &&
					required(mode).every((track) => stream.tracks.includes(track))
				)
					return;
			}
		} catch {
			/* 启动或切换轨道时媒体服务短暂不可用。 */
		}
		await delay(200);
	}
	throw Object.assign(
		new Error("流尚未就绪，或 WebRTC 协商失败，请检查采集状态"),
		{ statusCode: 503 },
	);
}
