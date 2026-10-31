import type { AppConfig } from "@lanvoryn/shared";

/** 只生成参数数组，永远不通过 shell 拼接执行；设备和数值由共享 schema 限制。 */
export function ffmpegArgs(
	config: AppConfig,
	source: "linux" | "demo",
	output: string,
): string[] {
	const { video: v, audio: a } = config;
	const args = [
		"-hide_banner",
		"-nostdin",
		"-loglevel",
		"warning",
		"-progress",
		"pipe:1",
		"-stats_period",
		"2",
	];
	if (v.enabled) {
		if (source === "demo")
			args.push(
				"-re",
				"-f",
				"lavfi",
				"-i",
				`testsrc2=size=${v.width}x${v.height}:rate=${v.fps}`,
			);
		else
			args.push(
				"-thread_queue_size",
				"512",
				"-f",
				"v4l2",
				"-input_format",
				v.inputFormat,
				"-video_size",
				`${v.width}x${v.height}`,
				"-framerate",
				`${v.fps}`,
				"-i",
				v.device,
			);
	}
	if (a.enabled) {
		// 正偏移延后声音；负偏移延后视频。两种输入使用同一 FFmpeg 时间线。
		if (a.offsetMs > 0) args.push("-itsoffset", `${a.offsetMs / 1000}`);
		if (source === "demo")
			args.push(
				"-re",
				"-f",
				"lavfi",
				"-i",
				`sine=frequency=440:sample_rate=${a.sampleRate}`,
			);
		else
			args.push(
				"-thread_queue_size",
				"512",
				"-f",
				"alsa",
				"-sample_rate",
				a.sampleRate,
				"-channels",
				`${a.channels}`,
				"-i",
				a.device,
			);
	}
	if (v.enabled) {
		args.push("-map", "0:v:0");
		const filters: string[] = [];
		if (v.rotation === "90") filters.push("transpose=1");
		if (v.rotation === "180") filters.push("hflip", "vflip");
		if (v.rotation === "270") filters.push("transpose=2");
		if (v.mirror) filters.push("hflip");
		if (a.enabled && a.offsetMs < 0)
			filters.push(`setpts=PTS+${-a.offsetMs / 1000}/TB`);
		if (filters.length) args.push("-vf", filters.join(","));
		args.push(
			"-c:v",
			v.encoder,
			"-pix_fmt",
			"yuv420p",
			"-profile:v",
			"baseline",
			"-bf",
			"0",
			"-g",
			`${v.fps * v.keyframeSeconds}`,
			"-b:v",
			`${v.bitrateKbps}k`,
			"-maxrate",
			`${v.bitrateKbps}k`,
			"-bufsize",
			`${v.bitrateKbps}k`,
		);
		if (v.encoder === "h264_nvenc")
			args.push(
				"-preset",
				"p2",
				"-tune",
				"ull",
				"-rc",
				"cbr",
				"-rc-lookahead",
				"0",
			);
		else args.push("-preset", "veryfast", "-tune", "zerolatency");
	}
	if (a.enabled) {
		args.push("-map", `${v.enabled ? 1 : 0}:a:0`);
		const filters = ["aresample=async=1:first_pts=0", `volume=${a.gainDb}dB`];
		if (a.highpass) filters.push("highpass=f=100");
		if (a.noiseSuppression) filters.push("afftdn=nf=-25");
		filters.push("alimiter=limit=0.95:level=false:latency=true");
		args.push(
			"-af",
			filters.join(","),
			"-c:a",
			"libopus",
			"-application",
			"lowdelay",
			"-ar",
			"48000",
			"-ac",
			`${a.channels}`,
			"-b:a",
			`${a.bitrateKbps}k`,
		);
	}
	args.push("-rtsp_transport", "tcp", "-f", "rtsp", output);
	return args;
}
