import { execFile } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { promisify } from "node:util";
import type { CameraControl, DeviceMode, Devices } from "@lanvoryn/shared";
import { env } from "./environment.js";

const exec = promisify(execFile);
async function run(command: string, args: string[]) {
	return (
		await exec(command, args, {
			timeout: 8000,
			maxBuffer: 1024 * 1024,
			env: { ...process.env, LC_ALL: "C" },
		})
	).stdout;
}

export function parseModes(text: string): DeviceMode[] {
	const modes: DeviceMode[] = [];
	let format: DeviceMode["inputFormat"] | undefined;
	let current: DeviceMode | undefined;
	for (const line of text.split("\n")) {
		const fmt = line.match(/\[\d+\]: '([^']+)'/);
		if (fmt) {
			format =
				fmt[1] === "MJPG" ? "mjpeg" : fmt[1] === "YUYV" ? "yuyv422" : undefined;
			current = undefined;
		}
		const size = line.match(/Size: Discrete (\d+)x(\d+)/);
		if (size && format) {
			current = {
				inputFormat: format,
				width: Number(size[1]),
				height: Number(size[2]),
				fps: [],
			};
			modes.push(current);
		}
		const fps = line.match(/\(([\d.]+) fps\)/);
		if (fps && current)
			current.fps = [...new Set([...current.fps, Number(fps[1])])];
	}
	return modes.filter(
		(mode, i) =>
			modes.findIndex(
				(m) =>
					m.inputFormat === mode.inputFormat &&
					m.width === mode.width &&
					m.height === mode.height,
			) === i,
	);
}

export function parseControls(text: string): CameraControl[] {
	const controls: CameraControl[] = [];
	let current: CameraControl | undefined;
	for (const line of text.split("\n")) {
		const match = line.match(
			/^\s*(\w+)\s+0x[\da-f]+\s+\(([^)]+)\)\s*:\s*(.*)$/i,
		);
		if (match) {
			const values = Object.fromEntries(
				[...match[3]!.matchAll(/(min|max|step|default|value)=(-?\d+)/g)].map(
					(m) => [m[1]!, Number(m[2])],
				),
			);
			current = {
				name: match[1]!,
				type: match[2]!,
				min: values.min ?? 0,
				max: values.max ?? 1,
				step: values.step ?? 1,
				default: values.default ?? 0,
				value: values.value ?? 0,
				readOnly:
					/read-only|inactive|disabled/.test(match[3]!) ||
					!["int", "bool", "menu", "intmenu"].includes(match[2]!),
				menu: {},
			};
			controls.push(current);
		} else {
			const menu = line.match(/^\s+(-?\d+):\s+(.+)$/);
			if (menu && current) current.menu[menu[1]!] = menu[2]!;
		}
	}
	return controls;
}

export async function getDevices(device: string): Promise<Devices> {
	const result: Devices = {
		source: env.LANVORYN_SOURCE,
		cameras: [],
		microphones: [],
		modes: [],
		controls: [],
		encoders: [],
		warnings: [],
	};
	try {
		const text = await run(env.LANVORYN_FFMPEG, ["-hide_banner", "-encoders"]);
		result.encoders = ["libx264", "h264_nvenc"].filter((name) =>
			new RegExp(`\\b${name}\\b`).test(text),
		);
	} catch {
		result.warnings.push("无法运行 FFmpeg，请检查安装和可执行路径。");
	}
	if (env.LANVORYN_SOURCE === "demo") {
		result.cameras = [
			{ path: "/dev/video0", name: "合成测试图（不是摄像头）" },
		];
		result.microphones = [
			{ id: "plughw:Camera,0", name: "440 Hz 测试音（不是麦克风）" },
		];
		return result;
	}
	if (process.platform !== "linux") {
		result.warnings.push(
			"真实 USB 采集仅支持 Linux。可显式设置 LANVORYN_SOURCE=demo 体验界面。",
		);
		return result;
	}
	try {
		for (const name of await readdir("/sys/class/video4linux")) {
			const label = (
				await readFile(`/sys/class/video4linux/${name}/name`, "utf8")
			).trim();
			result.cameras.push({ path: `/dev/${name}`, name: label });
		}
		try {
			for (const name of await readdir("/dev/v4l/by-id")) {
				if (!name.endsWith("video-index0")) continue;
				result.cameras.push({
					path: `/dev/v4l/by-id/${name}`,
					name: basename(name),
				});
			}
		} catch {
			/* 某些摄像头没有稳定的 by-id 路径。 */
		}
	} catch {
		result.warnings.push("未发现 V4L2 摄像头。");
	}
	try {
		const text = await run("arecord", ["-l"]);
		result.microphones = [
			...text.matchAll(/^card \d+: (\S+) \[([^\]]+)\], device (\d+): (.+)$/gm),
		].map((m) => ({ id: `plughw:${m[1]},${m[3]}`, name: `${m[2]} · ${m[4]}` }));
	} catch {
		result.warnings.push("无法枚举麦克风，请检查 alsa-utils 和 audio 组权限。");
	}
	try {
		await access(device);
		const [modes, controls] = await Promise.all([
			run(env.LANVORYN_V4L2_CTL, ["--device", device, "--list-formats-ext"]),
			run(env.LANVORYN_V4L2_CTL, ["--device", device, "--list-ctrls-menus"]),
		]);
		result.modes = parseModes(modes);
		result.controls = parseControls(controls);
	} catch {
		result.warnings.push(
			"当前摄像头无法查询：检查设备路径、占用情况和 video 组权限。",
		);
	}
	return result;
}

export async function setCameraControl(
	device: string,
	name: string,
	value: number,
) {
	const controls = parseControls(
		await run(env.LANVORYN_V4L2_CTL, ["--device", device, "--list-ctrls-menus"]),
	);
	const control = controls.find((c) => c.name === name);
	if (!control || control.readOnly)
		throw new Error("该控制项不存在或当前不可写");
	if (
		!Number.isInteger(value) ||
		value < control.min ||
		value > control.max ||
		(value - control.min) % control.step !== 0 ||
		(Object.keys(control.menu).length > 0 && !(String(value) in control.menu))
	)
		throw new Error("控制值超出设备允许范围");
	await run(env.LANVORYN_V4L2_CTL, [
		"--device",
		device,
		"--set-ctrl",
		`${name}=${value}`,
	]);
}
