import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	type ConfigDocument,
	configSchema,
	defaultConfig,
	type EventEntry,
} from "@lanvoryn/shared";

export async function atomicJson(path: string, value: unknown) {
	const temp = `${path}.${randomUUID()}.tmp`;
	await writeFile(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
	await rename(temp, path);
}

export class Store {
	document: ConfigDocument = {
		revision: 0,
		config: structuredClone(defaultConfig),
	};
	events: EventEntry[] = [];
	private eventWrite: Promise<void> = Promise.resolve();
	constructor(readonly dir: string) {}

	async init() {
		await mkdir(this.dir, { recursive: true, mode: 0o700 });
		try {
			const raw = JSON.parse(
				await readFile(join(this.dir, "config.json"), "utf8"),
			);
			if (!Number.isSafeInteger(raw.revision) || raw.revision < 0)
				throw new Error("配置版本无效");
			this.document = {
				revision: raw.revision,
				config: configSchema.parse(raw.config),
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			await atomicJson(join(this.dir, "config.json"), this.document);
		}
		try {
			this.events = JSON.parse(
				await readFile(join(this.dir, "events.json"), "utf8"),
			)
				.slice(-200)
				.map((event: EventEntry) => ({
					...event,
					id: event.id ?? randomUUID(),
				}));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}

	async save(document: ConfigDocument) {
		await atomicJson(join(this.dir, "config.json"), document);
		this.document = document;
	}

	event(
		level: EventEntry["level"],
		message: string,
		values?: EventEntry["values"],
	) {
		this.events.push({
			id: randomUUID(),
			at: new Date().toISOString(),
			level,
			message: message.slice(0, 1500),
			...(values ? { values } : {}),
		});
		this.events = this.events.slice(-200);
		this.eventWrite = this.eventWrite
			.catch(() => {})
			.then(() => atomicJson(join(this.dir, "events.json"), this.events));
	}

	async flush() {
		await this.eventWrite;
	}
}
