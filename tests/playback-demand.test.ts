import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PlaybackDemand } from "../apps/server/src/media/playback-demand.js";

test("idle releases both devices; capture follows the union of active playback modes", () => {
	const demand = new PlaybackDemand();
	assert.deepEqual(demand.inputs, { video: false, audio: false });
	assert.ok(demand.renew("one", "admin", "video"));
	assert.deepEqual(demand.inputs, { video: true, audio: false });
	assert.ok(demand.renew("two", "guest", "audio"));
	assert.deepEqual(demand.inputs, { video: true, audio: true });
	demand.remove("two", "guest");
	assert.deepEqual(demand.inputs, { video: true, audio: false });
	demand.remove("one", "admin");
	assert.deepEqual(demand.inputs, { video: false, audio: false });
});
test("abandoned tabs expire even without a DELETE; heartbeat extends only its own lease", () => {
	let now = 0;
	const demand = new PlaybackDemand(() => now);
	demand.renew("one", "admin", "av");
	now = 20000;
	demand.renew("one", "admin", "video");
	now = 30000;
	assert.deepEqual(demand.inputs, { video: true, audio: false });
	now = 50000;
	assert.deepEqual(demand.inputs, { video: false, audio: false });
});
test("leases are bounded, owner isolated and revoked with authentication", () => {
	const demand = new PlaybackDemand();
	const id = randomUUID();
	demand.renew(id, "one", "av");
	assert.equal(demand.renew(id, "two", "av"), false);
	demand.remove(id, "two");
	assert.equal(demand.has(id, "one"), true);
	for (let i = 0; i < 3; i++)
		assert.ok(demand.renew(randomUUID(), "one", "video"));
	assert.equal(demand.renew(randomUUID(), "one", "video"), false);
	demand.revokeOwner("one");
	assert.deepEqual(demand.inputs, { video: false, audio: false });
	for (let i = 0; i < 32; i++)
		assert.ok(demand.renew(randomUUID(), String(i), "audio"));
	assert.equal(demand.renew(randomUUID(), "extra", "audio"), false);
	demand.clear();
	assert.deepEqual(demand.inputs, { video: false, audio: false });
});
