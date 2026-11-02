import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("HTTP polling does not renew login; activity and playback do; logout persists across restart", async () => {
	const dir = await mkdtemp(join(tmpdir(), "lanvoryn-session-api-"));
	process.env.LANVORYN_DATA_DIR = dir;
	process.env.LANVORYN_SOURCE = "demo";
	process.env.LANVORYN_SESSION_IDLE_HOURS = "168";
	process.env.LANVORYN_SESSION_MAX_HOURS = "720";
	const { hashPassword } = await import("../apps/server/src/security/auth.js");
	const { createApp } = await import("../apps/server/src/app.js");
	const password = randomBytes(20).toString("hex");
	await writeFile(
		join(dir, "credentials.json"),
		JSON.stringify({
			admin: { username: "admin", hash: await hashPassword(password) },
			viewer: { enabled: false, hash: null },
		}),
		{ mode: 0o600 },
	);
	const day = 86400000;
	const start = Date.UTC(2026, 0, 1);
	let now = start;
	const options = { timers: false, logger: false, now: () => now };
	let instance = await createApp(options);
	const marker = { "x-lanvoryn-request": "1" };
	try {
		const login = await instance.app.inject({
			method: "POST",
			url: "/api/auth/login",
			headers: marker,
			payload: { username: "admin", password },
		});
		assert.equal(login.statusCode, 200);
		const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
		const headers = { ...marker, cookie };
		now += 6 * day;
		for (const url of [
			"/api/status",
			"/api/auth/me",
			"/api/config",
			"/api/security",
		]) {
			const response = await instance.app.inject({ url, headers });
			assert.equal(response.statusCode, 200);
			assert.equal(response.headers["set-cookie"], undefined);
		}
		assert.equal(
			(await instance.auth.list(""))[0]!.expiresAt,
			new Date(start + 7 * day).toISOString(),
		);
		assert.equal(
			(
				await instance.app.inject({
					method: "POST",
					url: "/api/auth/activity",
					headers: { cookie },
				})
			).statusCode,
			403,
		);
		const activity = await instance.app.inject({
			method: "POST",
			url: "/api/auth/activity",
			headers,
		});
		assert.equal(activity.statusCode, 204);
		assert.match(String(activity.headers["set-cookie"]), /Max-Age=604800/);
		assert.equal(
			(await instance.auth.list(""))[0]!.expiresAt,
			new Date(start + 13 * day).toISOString(),
		);
		now = start + 12 * day;
		await instance.app.inject({
			method: "POST",
			url: "/api/capture/start",
			headers,
		});
		instance.capture.reconcile = async () => {};
		const playback = await instance.app.inject({
			method: "PUT",
			url: `/api/playback/${randomUUID()}`,
			headers,
			payload: { mode: "video" },
		});
		assert.equal(playback.statusCode, 200);
		assert.equal(
			(await instance.auth.list(""))[0]!.expiresAt,
			new Date(start + 19 * day).toISOString(),
		);
		await instance.app.close();
		instance = await createApp(options);
		assert.equal(
			(await instance.app.inject({ url: "/api/auth/me", headers })).statusCode,
			200,
		);
		assert.equal(
			(
				await instance.app.inject({
					method: "POST",
					url: "/api/auth/logout",
					headers,
				})
			).statusCode,
			200,
		);
		await instance.app.close();
		instance = await createApp(options);
		assert.equal(
			(await instance.app.inject({ url: "/api/auth/me", headers })).statusCode,
			401,
		);
	} finally {
		await instance.app.close();
		await rm(dir, { recursive: true, force: true });
	}
});
