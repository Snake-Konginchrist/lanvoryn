import assert from "node:assert/strict";
import test from "node:test";
import { defaultConfig } from "@lanvoryn/shared";
import { afterControl, afterSave } from "../apps/web/src/config-draft.js";

test("save response keeps edits made while request was pending", () => {
	const submitted = structuredClone(defaultConfig);
	const current = { ...submitted, name: "newer edit" };
	assert.equal(afterSave(current, submitted, submitted).name, "newer edit");
	assert.deepEqual(afterSave(submitted, submitted, submitted), submitted);
	assert.notEqual(afterSave(submitted, submitted, submitted), submitted);
});
test("capture controls keep unsaved schedule and media edits", () => {
	const draft = structuredClone(defaultConfig);
	draft.capture.timezone = "Europe/Paris";
	draft.capture.windows = [
		{ id: "draft", days: [1], start: "09:00", end: "18:00" },
	];
	draft.video.width = 640;
	const persisted = structuredClone(defaultConfig);
	persisted.capture.policy = "manual";
	persisted.capture.manualEnabled = true;
	const result = afterControl(draft, persisted, "start");
	assert.deepEqual(result.capture.windows, draft.capture.windows);
	assert.equal(result.capture.timezone, "Europe/Paris");
	assert.equal(result.video.width, 640);
	assert.equal(result.capture.manualEnabled, true);
	assert.equal(afterControl(draft, persisted, "restart"), draft);
});
