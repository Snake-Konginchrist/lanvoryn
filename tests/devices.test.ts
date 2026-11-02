import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultConfig } from "@lanvoryn/shared";
import { parseControls, parseModes } from "../apps/server/src/media/devices.js";
import { ffmpegArgs } from "../apps/server/src/media/ffmpeg.js";

test("正确解析 V4L2 格式，排除浏览器管线不支持的输入格式", () => {
	assert.deepEqual(
		parseModes(`[0]: 'MJPG' (Motion-JPEG)
    Size: Discrete 3840x2160
      Interval: Discrete 0.033s (30.000 fps)
      Interval: Discrete 0.040s (25.000 fps)
  [1]: 'YUYV'
    Size: Discrete 640x480
      Interval: Discrete 0.033s (30.000 fps)
  [2]: 'H264'
    Size: Discrete 1920x1080`),
		[
			{ inputFormat: "mjpeg", width: 3840, height: 2160, fps: [30, 25] },
			{ inputFormat: "yuyv422", width: 640, height: 480, fps: [30] },
		],
	);
});
test("保留硬件控制菜单以及只读 / inactive 标记", () => {
	const parsed =
		parseControls(`brightness 0x00980900 (int) : min=-64 max=64 step=1 default=0 value=5
  exposure_auto 0x009a0901 (menu) : min=0 max=3 default=3 value=3
      1: Manual Mode
      3: Aperture Priority Mode
  exposure_absolute 0x009a0902 (int) : min=1 max=10000 step=1 default=166 value=166 flags=inactive`);
	assert.equal(parsed[0]?.min, -64);
	assert.equal(parsed[1]?.menu["3"], "Aperture Priority Mode");
	assert.equal(parsed[2]?.readOnly, true);
});
test("音频或视频单独采集时，映射和编码参数仍正确", () => {
	const audio = structuredClone(defaultConfig);
	audio.video.enabled = false;
	const args = ffmpegArgs(audio, "linux", "rtsp://127.0.0.1:8554/live");
	assert.equal(args.includes("v4l2"), false);
	assert.equal(args.includes("0:a:0"), true);
	assert.equal(args.includes("libopus"), true);
	const video = structuredClone(defaultConfig);
	video.audio.enabled = false;
	const videoArgs = ffmpegArgs(video, "linux", "rtsp://127.0.0.1:8554/live");
	assert.equal(videoArgs.includes("alsa"), false);
	assert.equal(videoArgs.includes("0:v:0"), true);
	assert.equal(videoArgs.includes("libopus"), false);
});
