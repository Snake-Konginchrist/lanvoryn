import { randomBytes, scryptSync } from "node:crypto";
import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

// 密码仅通过本地终端交互输入，不使用命令行参数，避免进入 shell 历史。
async function hidden(question) {
	if (!process.stdin.isTTY)
		throw new Error("请在交互终端运行 setup，以便隐藏密码输入。");
	process.stdout.write(question);
	process.stdin.setRawMode(true);
	process.stdin.resume();
	return new Promise((resolveInput, reject) => {
		let answer = "";
		const done = () => {
			process.stdin.off("data", onData);
			process.stdin.setRawMode(false);
			process.stdin.pause();
			process.stdout.write("\n");
		};
		const onData = (data) => {
			for (const char of data.toString()) {
				if (char === "\u0003") {
					done();
					reject(new Error("已取消"));
					return;
				}
				if (char === "\r" || char === "\n") {
					done();
					resolveInput(answer);
					return;
				}
				if (char === "\u007f" || char === "\b") answer = answer.slice(0, -1);
				else if (char >= " ") answer += char;
			}
		};
		process.stdin.on("data", onData);
	});
}

try {
	const dir = resolve(process.env.LANVORYN_DATA_DIR || "./data");
	await mkdir(dir, { recursive: true, mode: 0o700 });
	const path = join(dir, "credentials.json");
	let exists = false;
	try {
		await access(path);
		exists = true;
	} catch {
		/* 首次设置。 */
	}
	const input = createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	if (
		exists &&
		(await input.question(
			"已存在账号。重置会使现有密码失效；请先停止服务。输入 RESET 继续：",
		)) !== "RESET"
	) {
		input.close();
		process.exit(0);
	}
	const username =
		(await input.question("管理员账号 [admin]：")).trim() || "admin";
	input.close();
	if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(username) || username === "viewer")
		throw new Error(
			"账号只允许字母、数字、下划线、点和横线，且不能为 viewer。",
		);
	const password = await hidden("管理员密码（至少 12 字符，输入不显示）：");
	const confirm = await hidden("再次输入密码：");
	if (password.length < 12 || password.length > 128 || password !== confirm)
		throw new Error("密码长度应为 12–128 字符，且两次输入必须一致。");
	const salt = randomBytes(16).toString("hex");
	const key = scryptSync(password, salt, 32, {
		N: 32768,
		r: 8,
		p: 1,
		maxmem: 64 * 1024 * 1024,
	}).toString("hex");
	let viewer = { enabled: false, hash: null };
	if (exists) viewer = JSON.parse(await readFile(path, "utf8")).viewer;
	const { writeFile } = await import("node:fs/promises");
	await writeFile(
		path,
		JSON.stringify(
			{ admin: { username, hash: `scrypt:32768:${salt}:${key}` }, viewer },
			null,
			2,
		),
		{ mode: 0o600 },
	);
	if (!process.env.LANVORYN_DATA_DIR) {
		try {
			await copyFile(".env.example", ".env", 1);
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
		}
	}
	console.log(
		"管理员已设置。请编辑 .env，然后运行 npm run media:install 和 npm run media:config。",
	);
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
