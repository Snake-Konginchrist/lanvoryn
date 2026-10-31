import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// MediaMTX 没有 npm 安装器：只下载上游官方稳定版，并强制验证官方 SHA-256。
const root = resolve(".runtime/media");
const version = process.env.LANVORYN_MEDIAMTX_VERSION;
const endpoint = version ? `tags/${version}` : "latest";
async function get(url) {
	const response = await fetch(url, {
		headers: {
			"User-Agent": "lanvoryn-installer",
			Accept: "application/vnd.github+json",
		},
		signal: AbortSignal.timeout(120000),
	});
	if (!response.ok) throw new Error(`下载失败：HTTP ${response.status} ${url}`);
	return response;
}
try {
	if (
		!["linux", "darwin"].includes(process.platform) ||
		!["x64", "arm64"].includes(process.arch)
	)
		throw new Error(
			"此脚本支持 Linux/macOS 的 x64/arm64；其他平台请按上游文档安装。",
		);
	const release = await (
		await get(
			`https://api.github.com/repos/bluenviron/mediamtx/releases/${endpoint}`,
		)
	).json();
	if (release.prerelease || release.draft)
		throw new Error("不安装预发行版或草稿");
	const name = `mediamtx_${release.tag_name}_${process.platform}_${process.arch === "x64" ? "amd64" : "arm64"}.tar.gz`;
	const archive = release.assets.find((asset) => asset.name === name);
	const checksum = release.assets.find(
		(asset) => asset.name === "checksums.sha256",
	);
	if (!archive || !checksum)
		throw new Error("官方发布没有提供当前平台的压缩包或校验文件");
	await mkdir(root, { recursive: true });
	console.log(
		`下载官方 MediaMTX ${release.tag_name}（${process.platform}/${process.arch}）…`,
	);
	const bytes = Buffer.from(
		await (await get(archive.browser_download_url)).arrayBuffer(),
	);
	const hashes = await (await get(checksum.browser_download_url)).text();
	const expected = hashes
		.split("\n")
		.map((line) => line.trim().split(/\s+/))
		.find((row) => row.at(-1)?.replace(/^\*/, "") === name)?.[0];
	if (
		!expected ||
		createHash("sha256").update(bytes).digest("hex") !== expected
	)
		throw new Error("SHA-256 校验失败，已中止安装");
	const target = join(root, name);
	await writeFile(target, bytes);
	const members = execFileSync("tar", ["-tzf", target], { encoding: "utf8" })
		.trim()
		.split("\n");
	if (
		members.some(
			(path) => path.startsWith("/") || path.split("/").includes(".."),
		)
	)
		throw new Error("压缩包包含不安全的路径");
	execFileSync("tar", ["-xzf", target, "-C", root]);
	await chmod(join(root, "mediamtx"), 0o755);
	await writeFile(
		join(root, "release.json"),
		JSON.stringify(
			{ version: release.tag_name, sha256: expected, source: release.html_url },
			null,
			2,
		),
	);
	await rm(target);
	console.log(`已安装：${root}/mediamtx；校验通过。`);
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
