import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("真实 HTTP 路由：认证、访客隔离、CSRF、配置冲突和会话撤销", async () => {
	const dir = await mkdtemp(join(tmpdir(), "lanvoryn-api-"));
	process.env.LANVORYN_DATA_DIR = dir;
	process.env.LANVORYN_SOURCE = "demo";
	const { hashPassword } = await import("../apps/server/src/security/auth.js");
	const { createApp } = await import("../apps/server/src/app.js");
	const password = randomBytes(24).toString("hex");
	await writeFile(
		join(dir, "credentials.json"),
		JSON.stringify({
			admin: { username: "admin", hash: await hashPassword(password) },
			viewer: { enabled: false, hash: null },
		}),
		{ mode: 0o600 },
	);
	const { app, auth, rtc, capture } = await createApp({
		timers: false,
		logger: false,
	});
	const headers = { "x-lanvoryn-request": "1" };
	const login = async (username: string, pass: string) => {
		const response = await app.inject({
			method: "POST",
			url: "/api/auth/login",
			headers,
			payload: { username, password: pass },
		});
		return {
			response,
			cookie: response.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
		};
	};
	try {
		for (const url of [
			"/api/config",
			"/api/status",
			"/api/events",
			"/api/security",
		])
			assert.equal((await app.inject(url)).statusCode, 401);
		assert.equal(
			(
				await app.inject({
					method: "POST",
					url: "/api/whep",
					headers: { ...headers, "content-type": "application/sdp" },
					payload: "v=0",
				})
			).statusCode,
			401,
		);
		assert.equal(
			(await login("admin", "wrong-password")).response.statusCode,
			401,
		);
		const { response, cookie } = await login("admin", password);
		assert.equal(response.statusCode, 200);
		assert.match(String(response.headers["set-cookie"]), /HttpOnly/i);
		assert.match(String(response.headers["set-cookie"]), /SameSite=Strict/i);
		const adminHeaders = { ...headers, cookie };
		assert.equal(
			(
				await app.inject({
					method: "PUT",
					url: "/api/config",
					headers: { cookie },
					payload: {},
				})
			).statusCode,
			403,
		);
		assert.equal(
			(
				await app.inject({
					method: "POST",
					url: "/api/capture/stop",
					headers: { ...adminHeaders, origin: "https://evil.example" },
				})
			).statusCode,
			403,
		);
		const config = (
			await app.inject({ url: "/api/config", headers: adminHeaders })
		).json();
		config.config.name = "自动化验证现场";
		assert.equal(
			(
				await app.inject({
					method: "PUT",
					url: "/api/config",
					headers: adminHeaders,
					payload: config,
				})
			).statusCode,
			200,
		);
		assert.equal(
			(
				await app.inject({
					method: "PUT",
					url: "/api/config",
					headers: adminHeaders,
					payload: config,
				})
			).statusCode,
			409,
		);
		assert.equal(
			(
				await app.inject({
					method: "PUT",
					url: "/api/security/viewer",
					headers: adminHeaders,
					payload: { enabled: true, password },
				})
			).statusCode,
			200,
		);
		const viewer = await login("viewer", password);
		assert.equal(viewer.response.statusCode, 200);
		const viewerHeaders = { ...headers, cookie: viewer.cookie };
		for (const url of [
			"/api/config",
			"/api/devices",
			"/api/events",
			"/api/security",
		])
			assert.equal(
				(await app.inject({ url, headers: viewerHeaders })).statusCode,
				403,
			);
		assert.equal(
			(await app.inject({ url: "/api/status", headers: viewerHeaders }))
				.statusCode,
			200,
		);
		assert.equal(
			(
				await app.inject({
					method: "POST",
					url: "/api/capture/start",
					headers: viewerHeaders,
				})
			).statusCode,
			403,
		);
		// 播放授权不等于采集：无观看需求时不启动设备。
		await app.inject({
			method: "POST",
			url: "/api/capture/start",
			headers: adminHeaders,
		});
		assert.equal((await capture.status(0)).pid, null);
		const { randomUUID } = await import("node:crypto");
		const lease = randomUUID();
		const originalReconcile = capture.reconcile.bind(capture);
		capture.reconcile = async () => {};
		try {
			const unauthorized = await app.inject({
				method: "PUT",
				url: `/api/playback/${lease}`,
				headers,
				payload: { mode: "video" },
			});
			assert.equal(unauthorized.statusCode, 401);
			const created = await app.inject({
				method: "PUT",
				url: `/api/playback/${lease}`,
				headers: viewerHeaders,
				payload: { mode: "video" },
			});
			assert.equal(created.statusCode, 200);
			assert.deepEqual(capture.demand.inputs, { video: true, audio: false });
			await app.inject({
				method: "DELETE",
				url: `/api/playback/${lease}`,
				headers: adminHeaders,
			});
			assert.deepEqual(capture.demand.inputs, { video: true, audio: false });
			const wrongMedia = await app.inject({
				method: "POST",
				url: "/api/whep",
				headers: {
					...viewerHeaders,
					"content-type": "application/sdp",
					"x-lanvoryn-playback": lease,
				},
				payload: "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
			});
			assert.equal(wrongMedia.statusCode, 400);
			await app.inject({
				method: "DELETE",
				url: `/api/playback/${lease}`,
				headers: viewerHeaders,
			});
			assert.deepEqual(capture.demand.inputs, { video: false, audio: false });
			await app.inject({
				method: "PUT",
				url: `/api/playback/${lease}`,
				headers: viewerHeaders,
				payload: { mode: "av" },
			});
			await app.inject({
				method: "POST",
				url: "/api/capture/stop",
				headers: adminHeaders,
			});
			assert.deepEqual(capture.demand.inputs, { video: false, audio: false });
			const disabled = await app.inject({
				method: "PUT",
				url: `/api/playback/${lease}`,
				headers: viewerHeaders,
				payload: { mode: "av" },
			});
			assert.equal(disabled.statusCode, 409);
		} finally {
			capture.reconcile = originalReconcile;
		}

		let revoked = "";
		const original = rtc.revokeOwner.bind(rtc);
		rtc.revokeOwner = async (id) => {
			revoked = id;
			await original(id);
		};
		const sessions = (
			await app.inject({ url: "/api/security", headers: adminHeaders })
		).json().sessions;
		const viewerId = sessions.find(
			(s: { role: string }) => s.role === "viewer",
		).id;
		await app.inject({
			method: "DELETE",
			url: `/api/security/sessions/${viewerId}`,
			headers: adminHeaders,
		});
		assert.equal(revoked, viewerId);
		assert.equal(
			(await app.inject({ url: "/api/status", headers: viewerHeaders }))
				.statusCode,
			401,
		);
		assert.equal((await auth.list("")).length, 1);
	} finally {
		await app.close();
		await rm(dir, { recursive: true, force: true });
	}
});
