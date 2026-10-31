import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("所有八种语言具有相同键和插值，不以中文代替其他语言", async () => {
	const locales = ["zh-CN", "zh-TW", "en", "ja", "ko", "es", "fr", "de"];
	const resources = await Promise.all(
		locales.map(
			async (lang) =>
				JSON.parse(
					await readFile(`apps/web/src/locales/${lang}.json`, "utf8"),
				) as Record<string, string>,
		),
	);
	const keys = Object.keys(resources[0]!).sort();
	assert.ok(keys.length >= 280);
	for (let i = 1; i < resources.length; i++) {
		assert.deepEqual(Object.keys(resources[i]!).sort(), keys, locales[i]);
		for (const key of keys) {
			const value = resources[i]![key]!;
			assert.ok(value.trim().length > 0, `${locales[i]}:${key}`);
			assert.deepEqual(
				value.match(/\{\{\w+\}\}/g)?.sort() ?? [],
				key.match(/\{\{\w+\}\}/g)?.sort() ?? [],
			);
			if (["en", "es", "fr", "de"].includes(locales[i]!))
				assert.equal(
					/[\u3400-\u9fff]/.test(value),
					false,
					`${locales[i]}:${key}`,
				);
		}
	}
});
