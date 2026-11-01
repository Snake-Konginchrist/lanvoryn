import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

test("anonymous probes stay silent and stale requests cannot end a new login", async () => {
	const source = await readFile(
		new URL("../apps/web/src/api.ts", import.meta.url),
		"utf8",
	);
	const script = stripTypeScriptTypes(
		source.replace('import { t } from "./i18n";', ""),
		{ mode: "strip" },
	).replace(/^export /gm, "");
	const events = new EventTarget();
	let expired = 0;
	events.addEventListener("lanvoryn:unauthorized", () => expired++);
	let handler: () => Promise<Response> = async () =>
		Response.json({ message: "请先登录" }, { status: 401 });
	const context = {
		window: events,
		Event,
		t: (key: string) => key,
		fetch: () => handler(),
		exports: {} as {
			api: (
				path: string,
				options?: Record<string, unknown>,
			) => Promise<unknown>;
		},
	};
	runInNewContext(script + "\nglobalThis.exports = { api };", context);
	const api = context.exports.api;
	await assert.rejects(api("/auth/me", { silentUnauthorized: true }));
	assert.equal(expired, 0);
	await assert.rejects(api("/auth/login", { method: "POST" }));
	assert.equal(expired, 0);
	await assert.rejects(api("/status"));
	assert.equal(expired, 1);
	let resolveOld: (value: Response) => void = () => {};
	handler = () =>
		new Promise<Response>((resolve) => {
			resolveOld = resolve;
		});
	const stale = api("/status");
	handler = async () => Response.json({ role: "admin" });
	await api("/auth/login", { method: "POST" });
	resolveOld(Response.json({ message: "请先登录" }, { status: 401 }));
	await assert.rejects(stale);
	assert.equal(expired, 1);
	handler = async () =>
		Response.json({ message: "会话已过期" }, { status: 401 });
	await assert.rejects(api("/status"));
	assert.equal(expired, 2);
});
