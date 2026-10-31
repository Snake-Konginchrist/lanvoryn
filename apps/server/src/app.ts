import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import Fastify from "fastify";
import { ZodError } from "zod";
import { Auth } from "./auth.js";
import { Capture } from "./capture.js";
import { dataDir, env } from "./environment.js";
import { networkGuards } from "./network.js";
import { routes } from "./routes.js";
import { Store } from "./storage.js";
import { WebRTC } from "./webrtc.js";

export async function createApp(
	options: { timers?: boolean; logger?: boolean } = {},
) {
	const app = Fastify({
		logger: options.logger ?? true,
		bodyLimit: 262144,
		trustProxy: false,
		requestTimeout: 15000,
		connectionTimeout: 15000,
	});
	await app.register(cookie);
	await app.register(helmet, {
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				fontSrc: ["'self'"],
				imgSrc: ["'self'", "blob:", "data:"],
				mediaSrc: ["'self'", "blob:"],
				connectSrc: ["'self'"],
				frameAncestors: ["'none'"],
				upgradeInsecureRequests: null,
			},
		},
		strictTransportSecurity: env.LANVORYN_SECURE_COOKIE === "true",
		crossOriginEmbedderPolicy: false,
	});
	await app.register(rateLimit, { max: 240, timeWindow: "1 minute" });
	networkGuards(app);
	const store = new Store(dataDir);
	await store.init();
	const auth = new Auth(
		dataDir,
		env.LANVORYN_SESSION_HOURS,
		env.LANVORYN_SECURE_COOKIE === "true",
	);
	await auth.init();
	const capture = new Capture(store);
	const rtc = new WebRTC();
	auth.onRevoke = (id) => {
		void rtc.revokeOwner(id);
	};
	await routes(app, store, auth, capture, rtc);
	const webRoot = fileURLToPath(new URL("../../web/dist/", import.meta.url));
	if (existsSync(webRoot)) {
		await app.register(staticFiles, { root: webRoot, maxAge: 0 });
		app.setNotFoundHandler((request, reply) => {
			if (request.url.startsWith("/api/"))
				return reply.code(404).send({ message: "接口不存在" });
			return reply.sendFile("index.html");
		});
	}
	app.setErrorHandler(
		(error: Error & { statusCode?: number }, _request, reply) => {
			if (error instanceof ZodError)
				return reply.code(400).send({
					message: error.issues
						.map((i) => `${i.path.join(".")}: ${i.message}`)
						.join("；"),
				});
			const code = error.statusCode ?? 500;
			if (code >= 500) app.log.error(error);
			return reply.code(code).send({
				message:
					code >= 500 ? "服务暂时不可用，请检查运行状态和日志" : error.message,
			});
		},
	);
	let tick: ReturnType<typeof setInterval> | undefined;
	if (options.timers !== false) {
		await capture.reconcile();
		let ticking = false;
		tick = setInterval(async () => {
			if (ticking) return;
			ticking = true;
			try {
				auth.prune();
				await Promise.all([capture.reconcile(), rtc.prune()]);
			} catch (error) {
				app.log.error(error);
			} finally {
				ticking = false;
			}
		}, 10000);
		tick.unref();
	}
	app.addHook("onClose", async () => {
		clearInterval(tick);
		await rtc.closeAll();
		await capture.stop();
		await store.flush();
	});
	return { app, store, auth, capture, rtc };
}
