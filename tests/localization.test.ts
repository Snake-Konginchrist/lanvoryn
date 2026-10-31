import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const directory = new URL("../apps/web/src/locales/", import.meta.url);
const languages = ["en", "zh-CN", "zh-TW", "ja", "ko", "es", "fr", "de"];
const dictionaries = Object.fromEntries(
	await Promise.all(
		languages.map(async (language) => [
			language,
			JSON.parse(
				await readFile(new URL(`${language}.json`, directory), "utf8"),
			) as Record<string, string>,
		]),
	),
);

test("all eight locales cover the same messages and interpolation parameters", () => {
	const reference = dictionaries["zh-CN"]!;
	const placeholders = (value: string) =>
		[...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort();
	for (const language of languages) {
		const dictionary = dictionaries[language]!;
		assert.deepEqual(
			Object.keys(dictionary).sort(),
			Object.keys(reference).sort(),
			language,
		);
		for (const [key, value] of Object.entries(dictionary)) {
			assert.ok(value.trim(), `${language}: ${key}`);
			assert.deepEqual(
				placeholders(value),
				placeholders(key),
				`${language}: ${key}`,
			);
		}
	}
});

test("literal UI translation keys exist in every locale", async () => {
	async function visit(directory: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) await visit(path);
			else if (path.endsWith(".tsx")) {
				const source = await readFile(path, "utf8");
				for (const match of source.matchAll(/\bt\(\s*"([^"\n]+)"/g)) {
					for (const language of languages)
						assert.ok(
							Object.hasOwn(dictionaries[language]!, match[1]!),
							`${language}: ${match[1]} (${path})`,
						);
				}
			}
		}
	}
	await visit(new URL("../apps/web/src/", import.meta.url).pathname);
});
