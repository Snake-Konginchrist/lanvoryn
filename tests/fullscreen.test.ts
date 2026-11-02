import assert from "node:assert/strict";
import test from "node:test";
import { enterFullscreen } from "../apps/web/src/components/player/fullscreen.js";

test("fullscreen selects standard, iOS video or page fallback", async () => {
	let native = 0;
	const video = {
		webkitEnterFullscreen: () => native++,
	} as unknown as HTMLVideoElement;
	assert.equal(
		await enterFullscreen(
			{ requestFullscreen: async () => {} } as unknown as HTMLElement,
			video,
			true,
		),
		true,
	);
	assert.equal(native, 0);
	assert.equal(await enterFullscreen(null, video, true), true);
	assert.equal(native, 1);
	assert.equal(await enterFullscreen(null, video, false), false);
	assert.equal(
		await enterFullscreen(
			{
				requestFullscreen: async () => {
					throw new Error("denied");
				},
			} as unknown as HTMLElement,
			null,
			true,
		),
		false,
	);
	assert.equal(
		await enterFullscreen(
			null,
			{
				webkitEnterFullscreen: () => {
					throw new Error("unsupported");
				},
			} as unknown as HTMLVideoElement,
			true,
		),
		false,
	);
});
