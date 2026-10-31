import {
	type AppConfig,
	type ConfigDocument,
	configSchema,
} from "@lanvoryn/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { type Auth, passwordSchema, verifyPassword } from "./auth.js";
import type { Capture } from "./capture.js";
import { getDevices, setCameraControl } from "./devices.js";
import { env } from "./environment.js";
import { Geolocation } from "./geolocation.js";
import type { Store } from "./storage.js";
import type { WebRTC } from "./webrtc.js";

const failure = (message: string, statusCode = 400) =>
	Object.assign(new Error(message), { statusCode });

export async function routes(
	app: FastifyInstance,
	store: Store,
	auth: Auth,
	capture: Capture,
	rtc: WebRTC,
) {
	let mutation: Promise<unknown> = Promise.resolve();
	const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
		const next = mutation.then(fn);
		mutation = next.catch(() => {});
		return next;
	};
	const persist = async (config: AppConfig) => {
		const document = { config, revision: store.document.revision + 1 };
		await store.save(document);
		await capture.reconcile();
		return document;
	};

	app.get("/api/health", async () => ({ ok: true, version: "0.1.0" }));
	app.post(
		"/api/auth/login",
		{ config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
		async (request, reply) => {
			const body = z
				.object({
					username: z.string().min(1).max(64),
					password: z.string().min(1).max(128),
				})
				.strict()
				.parse(request.body);
			const session = await auth.login(
				body.username,
				body.password,
				request.ip,
				reply,
			);
			if (!session) {
				store.event("warn", "登录失败 · {{ip}}", { ip: request.ip });
				return reply.code(401).send({ message: "账号或密码错误" });
			}
			store.event(
				"info",
				session.role === "admin" ? "管理员登录 · {{ip}}" : "访客登录 · {{ip}}",
				{ ip: request.ip },
			);
			return { role: session.role };
		},
	);
	app.get("/api/auth/me", { preHandler: auth.require }, async (request) => ({
		role: request.session!.role,
	}));
	app.post(
		"/api/auth/logout",
		{ preHandler: auth.require },
		async (request, reply) => {
			auth.revoke(request.session!.id);
			reply.clearCookie("lanvoryn_session", { path: "/" });
			return { ok: true };
		},
	);
	app.get("/api/status", { preHandler: auth.require }, () =>
		capture.status(rtc.count),
	);
	app.get("/api/config", { preHandler: auth.admin }, () => store.document);
	app.put("/api/config", { preHandler: auth.admin }, (request) =>
		serialize(async () => {
			const body = z
				.object({
					revision: z.number().int().nonnegative(),
					config: configSchema,
				})
				.strict()
				.parse(request.body);
			if (body.revision !== store.document.revision)
				throw failure("配置已被其他页面修改，请重新加载后再保存", 409);
			const v = body.config.video;
			const old = store.document.config.video;
			if (
				env.LANVORYN_SOURCE === "linux" &&
				v.enabled &&
				JSON.stringify([v.device, v.width, v.height, v.fps, v.inputFormat]) !==
					JSON.stringify([
						old.device,
						old.width,
						old.height,
						old.fps,
						old.inputFormat,
					])
			) {
				const devices = await getDevices(v.device);
				if (
					!devices.modes.some(
						(m) =>
							m.width === v.width &&
							m.height === v.height &&
							m.inputFormat === v.inputFormat &&
							m.fps.some((f) => Math.abs(f - v.fps) < 0.1),
					)
				)
					throw failure(
						"该设备未报告此分辨率 / 帧率 / 输入格式组合，请先检查设备能力",
					);
			}
			const saved = await persist(body.config);
			store.event("info", "采集参数或定时计划已更新");
			return saved;
		}),
	);
	app.post("/api/capture/:action", { preHandler: auth.admin }, (request) =>
		serialize(async () => {
			const action = z
				.enum(["start", "stop", "restart"])
				.parse((request.params as { action: string }).action);
			if (action === "restart") {
				await capture.reconcile(true);
			} else {
				const config = structuredClone(store.document.config);
				config.capture.policy = "manual";
				config.capture.manualEnabled = action === "start";
				if (action === "stop") await rtc.closeAll();
				await persist(config);
			}
			store.event(
				"info",
				{
					start: "管理员开始采集",
					stop: "管理员停止采集",
					restart: "管理员重启采集",
				}[action],
			);
			return store.document;
		}),
	);
	app.get("/api/devices", { preHandler: auth.admin }, (request) => {
		const query = request.query as { device?: string };
		const device =
			query.device === undefined
				? store.document.config.video.device
				: configSchema.shape.video.shape.device.parse(query.device);
		return getDevices(device);
	});
	app.put("/api/devices/control", { preHandler: auth.admin }, (request) =>
		serialize(async () => {
			if (env.LANVORYN_SOURCE === "demo")
				throw failure("合成测试源没有摄像头硬件控制项");
			const body = z
				.object({
					name: z.string().regex(/^\w+$/).max(80),
					value: z.number().int(),
				})
				.strict()
				.parse(request.body);
			await setCameraControl(
				store.document.config.video.device,
				body.name,
				body.value,
			);
			store.event("info", "摄像头控制项 {{name}} 已更新为 {{value}}", {
				name: body.name,
				value: body.value,
			});
			return { ok: true };
		}),
	);
	app.get("/api/events", { preHandler: auth.admin }, () => ({
		events: [...store.events].reverse(),
	}));
	const geolocation = new Geolocation(env.LANVORYN_IP_GEOLOCATION === "true");
	app.get("/api/security", { preHandler: auth.admin }, async (request) => ({
		viewerEnabled: auth.credentials.viewer.enabled,
		username: auth.credentials.admin.username,
		sessions: await Promise.all(
			auth
				.list(request.session!.id)
				.map(async (session) => ({
					...session,
					location: await geolocation.lookup(session.ip),
				})),
		),
		secureCookie: env.LANVORYN_SECURE_COOKIE === "true",
		sessionHours: env.LANVORYN_SESSION_HOURS,
	}));
	app.put("/api/security/viewer", { preHandler: auth.admin }, (request) =>
		serialize(async () => {
			const body = z
				.discriminatedUnion("enabled", [
					z
						.object({ enabled: z.literal(true), password: passwordSchema })
						.strict(),
					z.object({ enabled: z.literal(false) }).strict(),
				])
				.parse(request.body);
			if (body.enabled) await auth.changePassword("viewer", body.password);
			else await auth.disableViewer();
			store.event(
				"info",
				body.enabled ? "访客访问已启用或密码已更新" : "访客访问已关闭",
			);
			return { ok: true };
		}),
	);
	app.put("/api/security/password", { preHandler: auth.admin }, (request) =>
		serialize(async () => {
			const body = z
				.object({ current: z.string().max(128), password: passwordSchema })
				.strict()
				.parse(request.body);
			if (!(await verifyPassword(body.current, auth.credentials.admin.hash)))
				throw failure("当前密码错误", 403);
			await auth.changePassword("admin", body.password);
			store.event("info", "管理员密码已修改，所有管理员会话已注销");
			return { ok: true };
		}),
	);
	app.delete(
		"/api/security/sessions/:id",
		{ preHandler: auth.admin },
		async (request) => {
			const id = z
				.string()
				.uuid()
				.parse((request.params as { id: string }).id);
			auth.revoke(id);
			return { ok: true };
		},
	);
	app.addContentTypeParser(
		"application/sdp",
		{ parseAs: "string", bodyLimit: 65536 },
		(_request, body, done) => done(null, body),
	);
	app.post(
		"/api/whep",
		{ preHandler: auth.require },
		async (request, reply) => {
			if (!request.headers["content-type"]?.startsWith("application/sdp"))
				throw failure("需要 application/sdp");
			const offer = z.string().min(20).max(65536).parse(request.body);
			const session = request.session!;
			const result = await rtc.offer(session.id, offer);
			// 协商期间如果发生退出或撤销，立即销毁刚刚建立的媒体会话。
			if (!auth.get(request)) {
				await rtc.remove(result.id);
				return reply.code(401).send({ message: "会话已过期" });
			}
			return reply
				.code(201)
				.header("Location", `/api/whep/${result.id}`)
				.type("application/sdp")
				.send(result.answer);
		},
	);
	app.delete(
		"/api/whep/:id",
		{ preHandler: auth.require },
		async (request, reply) => {
			const id = z
				.string()
				.uuid()
				.parse((request.params as { id: string }).id);
			await rtc.remove(id, request.session!.id);
			return reply.code(204).send();
		},
	);
}
