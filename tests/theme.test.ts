import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

test("theme: system changes, explicit choices, persistence, cross-tab sync and blocked storage", () => {
	const source = readFileSync("apps/web/public/theme-init.js", "utf8");
	function boot(saved: string | null = null, blocked = false) {
		let value = saved;
		const root = { dataset: {} as Record<string, string> };
		const meta = { content: "" };
		const events: Record<
			string,
			(event: { key: string; newValue: string | null }) => void
		> = {};
		let change = () => {};
		const system = {
			matches: false,
			addEventListener: (_: string, callback: () => void) => {
				change = callback;
			},
		};
		const window = {
			matchMedia: () => system,
			addEventListener: (name: string, callback: (typeof events)[string]) => {
				events[name] = callback;
			},
			lanvorynTheme: undefined as unknown as {
				get(): string;
				set(value: string): void;
			},
		};
		runInNewContext(source, {
			window,
			document: { documentElement: root, querySelector: () => meta },
			localStorage: {
				getItem: () => {
					if (blocked) throw new Error("blocked");
					return value;
				},
				setItem: (_: string, next: string) => {
					if (blocked) throw new Error("blocked");
					value = next;
				},
			},
		});
		return { root, window, meta, events, system, change, saved: () => value };
	}
	const app = boot();
	assert.equal(app.window.lanvorynTheme.get(), "system");
	assert.equal(app.root.dataset.theme, "light");
	app.system.matches = true;
	app.change();
	assert.equal(app.root.dataset.theme, "dark");
	app.window.lanvorynTheme.set("light");
	app.change();
	assert.equal(app.root.dataset.theme, "light");
	assert.equal(app.saved(), "light");
	assert.equal(boot(app.saved()).root.dataset.theme, "light");
	app.events.storage!({ key: "lanvoryn.theme", newValue: "dark" });
	assert.equal(app.root.dataset.theme, "dark");
	app.events.storage!({ key: "lanvoryn.theme", newValue: null });
	assert.equal(app.window.lanvorynTheme.get(), "system");
	assert.equal(boot("invalid").window.lanvorynTheme.get(), "system");
	const restricted = boot(null, true);
	restricted.window.lanvorynTheme.set("dark");
	assert.equal(restricted.root.dataset.theme, "dark");
});
