import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Store } from "../apps/server/src/storage.js";

test("FFmpeg never starts without viewers and opens only requested inputs", async () => {
	const dir = await mkdtemp(join(tmpdir(), "lanvoryn-demand-"));
	const program = join(dir, "ffmpeg-stub");
	await writeFile(
		program,
		`#!${process.execPath}\nprocess.stdout.write('progress=continue\\n');setInterval(()=>{},1000);`,
		{ mode: 0o700 },
	);
	process.env.LANVORYN_FFMPEG = program;
	process.env.LANVORYN_SOURCE = "linux";
	const { Capture } = await import("../apps/server/src/capture.js");
	const store = new Store(dir);
	await store.init();
	store.document.config.capture.policy = "always";
	const capture = new Capture(store);
	try {
		await capture.reconcile();
		assert.equal((await capture.status(0)).pid, null);
		capture.demand.renew("viewer", "owner", "video");
		await capture.reconcile();
		let status = await capture.status(1);
		assert.ok(status.pid);
		assert.deepEqual(status.capturing, { video: true, audio: false });
		capture.demand.renew("second", "other", "audio");
		await capture.reconcile();
		status = await capture.status(2);
		assert.deepEqual(status.capturing, { video: true, audio: true });
		capture.demand.remove("second", "other");
		await capture.reconcile();
		assert.deepEqual((await capture.status(1)).capturing, {
			video: true,
			audio: false,
		});
		capture.demand.remove("viewer", "owner");
		await capture.reconcile();
		status = await capture.status(0);
		assert.equal(status.pid, null);
		assert.deepEqual(status.capturing, { video: false, audio: false });
		capture.demand.renew("new", "owner", "audio");
		store.document.config.capture.policy = "manual";
		store.document.config.capture.manualEnabled = false;
		await capture.reconcile();
		assert.equal((await capture.status(1)).pid, null);
	} finally {
		await capture.stop();
		await store.flush();
		await rm(dir, { recursive: true, force: true });
	}
});
