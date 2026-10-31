import { execFileSync, spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { defaultConfig } from "../packages/shared/dist/index.js";

// 仅供自动化测试：独立数据目录、随机密码、只监听回环，不触碰用户配置。
const dir = ".runtime/e2e";
await rm(`${dir}/data`, { recursive: true, force: true });
await mkdir(`${dir}/data`, { recursive: true, mode: 0o700 });
const password = randomBytes(20).toString("hex");
const salt = randomBytes(16).toString("hex");
const hash = `scrypt:32768:${salt}:${scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex")}`;
await writeFile(`${dir}/password`, password, { mode: 0o600 });
await writeFile(
	`${dir}/data/credentials.json`,
	JSON.stringify({
		admin: { username: "admin", hash },
		viewer: { enabled: false, hash: null },
	}),
	{ mode: 0o600 },
);
const config = structuredClone(defaultConfig);
config.video.width = 1280;
config.video.height = 720;
config.video.bitrateKbps = 1800;
await writeFile(
	`${dir}/data/config.json`,
	JSON.stringify({ revision: 0, config }),
	{ mode: 0o600 },
);
const environment = {
	...process.env,
	LANVORYN_DATA_DIR: `${dir}/data`,
	LANVORYN_SOURCE: "demo",
	LANVORYN_HOST: "127.0.0.1",
	LANVORYN_PORT: "13210",
	LANVORYN_MEDIA_HOST: "127.0.0.1",
	LANVORYN_MEDIAMTX_CONFIG: `${dir}/mediamtx.yml`,
	LANVORYN_ALLOWED_CIDRS: "",
	LANVORYN_PUBLIC_ORIGIN: "",
	LANVORYN_SECURE_COOKIE: "false",
};
execFileSync(process.execPath, ["scripts/media-config.mjs"], {
	env: environment,
	stdio: "inherit",
});
const media = spawn(".runtime/media/mediamtx", [`${dir}/mediamtx.yml`], {
	stdio: "inherit",
	env: environment,
});
const server = spawn(process.execPath, ["apps/server/dist/index.js"], {
	stdio: "inherit",
	env: environment,
});
let stopping = false;
function stop() {
	if (stopping) return;
	stopping = true;
	server.kill("SIGTERM");
	media.kill("SIGTERM");
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
for (const child of [media, server]) {
	child.on("error", (error) => {
		console.error(error.message);
		stop();
		process.exitCode = 1;
	});
	child.on("exit", (code) => {
		if (!stopping) {
			stop();
			process.exitCode = code || 1;
		}
	});
}
