import type { AppConfig, Role } from "./config.js";

export interface EventEntry {
	id: string;
	at: string;
	level: "info" | "warn" | "error";
	message: string;
	values?: Record<string, string | number>;
}
export interface ConfigDocument {
	revision: number;
	config: AppConfig;
}
export interface DeviceMode {
	inputFormat: "mjpeg" | "yuyv422";
	width: number;
	height: number;
	fps: number[];
}
export interface CameraControl {
	name: string;
	type: string;
	min: number;
	max: number;
	step: number;
	default: number;
	value: number;
	readOnly: boolean;
	menu: Record<string, string>;
}
export interface Devices {
	source: "linux" | "demo";
	cameras: { path: string; name: string }[];
	microphones: { id: string; name: string }[];
	modes: DeviceMode[];
	controls: CameraControl[];
	encoders: string[];
	warnings: string[];
}
export interface RuntimeStatus {
	state: "stopped" | "starting" | "running" | "retrying" | "error";
	desired: boolean;
	source: "linux" | "demo";
	since: string | null;
	pid: number | null;
	restarts: number;
	error: string | null;
	mediaOnline: boolean;
	streamReady: boolean;
	viewers: number;
	hostname: string;
	addresses: string[];
	next: { at: string; enabled: boolean } | null;
	video: AppConfig["video"];
	audio: AppConfig["audio"];
	name: string;
	policy: AppConfig["capture"]["policy"];
	timezone: string;
	serverTime: string;
}
export interface SessionInfo {
	id: string;
	role: Role;
	ip: string;
	createdAt: string;
	expiresAt: string;
	current: boolean;
}
