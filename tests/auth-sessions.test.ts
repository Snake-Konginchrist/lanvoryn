import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Auth, hashPassword } from "../apps/server/src/security/auth.js";

const day = 86400000;

async function fixture() {
	const dir = await mkdtemp(join(tmpdir(), "lanvoryn-session-"));
	const password = randomBytes(20).toString("hex");
	await writeFile(
		join(dir, "credentials.json"),
		JSON.stringify({
			admin: { username: "admin", hash: await hashPassword(password) },
			viewer: { enabled: true, hash: await hashPassword(password) },
		}),
		{ mode: 0o600 },
	);
	let now = Date.UTC(2026, 0, 1);
	const open = async () => {
		const auth = new Auth(dir, 168, false, 720, () => now);
		await auth.init();
		return auth;
	};
	const cookies: {
		token: string;
		options: { maxAge: number; httpOnly: boolean; sameSite: string };
	}[] = [];
	const reply = {
		setCookie: (
			_name: string,
			token: string,
			options: (typeof cookies)[number]["options"],
		) => {
			cookies.push({ token, options });
		},
	} as unknown as FastifyReply;
	const login = async (auth: Auth, username = "admin") => {
		const session = await auth.login(username, password, "127.0.0.1", reply);
		assert.ok(session);
		const token = cookies.at(-1)!.token;
		return {
			session,
			token,
			request: { cookies: { lanvoryn_session: token } } as FastifyRequest,
		};
	};
	return {
		dir,
		password,
		open,
		login,
		reply,
		cookies,
		setDay: (value: number) => {
			now = Date.UTC(2026, 0, 1) + value * day;
		},
		cleanup: () => rm(dir, { recursive: true, force: true }),
	};
}

test("active sessions slide for seven days but cannot outlive thirty days", async () => {
	const f = await fixture();
	try {
		const auth = await f.open();
		const { request, session } = await f.login(auth);
		assert.equal(session.expires - session.created, 7 * day);
		assert.equal(f.cookies.at(-1)!.options.maxAge, 7 * 86400);
		assert.equal(f.cookies.at(-1)!.options.httpOnly, true);
		assert.equal(f.cookies.at(-1)!.options.sameSite, "strict");
		f.setDay(6);
		assert.ok(await auth.get(request));
		assert.equal(
			session.expires - session.created,
			7 * day,
			"reading a session does not renew it",
		);
		for (const dayNumber of [6, 12, 18, 24, 29]) {
			f.setDay(dayNumber);
			assert.equal(await auth.touch(request, f.reply), true);
			assert.equal(
				session.expires - session.created,
				Math.min(dayNumber + 7, 30) * day,
			);
		}
		assert.equal(f.cookies.at(-1)!.options.maxAge, 86400);
		f.setDay(30);
		assert.equal(await auth.get(request), undefined);
		assert.equal(await auth.touch(request, f.reply), false);
	} finally {
		await f.cleanup();
	}
});

test("sessions survive restart without storing reusable raw tokens; expired sessions stay expired", async () => {
	const f = await fixture();
	try {
		const auth = await f.open();
		const { request, token } = await f.login(auth);
		const file = join(f.dir, "sessions.json");
		assert.equal((await readFile(file, "utf8")).includes(token), false);
		assert.equal((await stat(file)).mode & 0o777, 0o600);
		f.setDay(6);
		const restarted = await f.open();
		assert.ok(await restarted.get(request));
		f.setDay(7);
		assert.equal(await restarted.get(request), undefined);
		assert.equal(await (await f.open()).get(request), undefined);
	} finally {
		await f.cleanup();
	}
});

test("logout, password changes and disabled guest access remain revoked after restart", async () => {
	const f = await fixture();
	try {
		let auth = await f.open();
		const first = await f.login(auth);
		await auth.revoke(first.session.id);
		auth = await f.open();
		assert.equal(await auth.get(first.request), undefined);
		const second = await f.login(auth);
		const viewer = await f.login(auth, "viewer");
		await auth.changePassword("admin", randomBytes(20).toString("hex"));
		auth = await f.open();
		assert.equal(await auth.get(second.request), undefined);
		assert.ok(
			await auth.get(viewer.request),
			"an administrator password change preserves guest sessions",
		);
		await auth.disableViewer();
		assert.equal(await (await f.open()).get(viewer.request), undefined);
	} finally {
		await f.cleanup();
	}
});

test("offline credential reset invalidates saved sessions even if old session records remain", async () => {
	const f = await fixture();
	try {
		const auth = await f.open();
		const { request } = await f.login(auth);
		const file = join(f.dir, "credentials.json");
		const credentials = JSON.parse(await readFile(file, "utf8"));
		credentials.admin.hash = await hashPassword(
			randomBytes(20).toString("hex"),
		);
		await writeFile(file, JSON.stringify(credentials), { mode: 0o600 });
		assert.equal(await (await f.open()).get(request), undefined);
	} finally {
		await f.cleanup();
	}
});

test("concurrent logins keep the persistent session store within its capacity", async () => {
	const f = await fixture();
	try {
		const initial = await f.open();
		await f.login(initial);
		const file = join(f.dir, "sessions.json");
		const saved = JSON.parse(await readFile(file, "utf8"));
		const template = saved.sessions[0];
		saved.sessions = Array.from({ length: 99 }, (_, i) => ({
			...template,
			id: randomUUID(),
			tokenHash: createHash("sha256").update(`fixture-${i}`).digest("hex"),
		}));
		await writeFile(file, JSON.stringify(saved), { mode: 0o600 });
		const auth = await f.open();
		await Promise.all(
			Array.from({ length: 3 }, () =>
				auth.login("admin", f.password, "127.0.0.1", f.reply),
			),
		);
		assert.equal((await auth.list("")).length, 100);
		assert.equal((await (await f.open()).list("")).length, 100);
	} finally {
		await f.cleanup();
	}
});
