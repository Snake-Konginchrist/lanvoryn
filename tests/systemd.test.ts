import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderUnit } from "../scripts/render-systemd.mjs";

test("systemd uses the chosen runtime and service user, including private nvm paths", () => {
	const template = readFileSync("deploy/lanvoryn.service", "utf8");
	const unit = renderUnit(template, {
		node: "/home/example/.nvm/versions/node/v26.12.0/bin/node",
		user: "example",
		group: "example",
	});
	assert.match(
		unit,
		/ExecStart="\/home\/example\/\.nvm\/versions\/node\/v26\.12\.0\/bin\/node"/,
	);
	assert.match(unit, /User=example\nGroup=example/);
	assert.match(unit, /ProtectHome=read-only/);
	assert.equal(unit.includes("@NODE_COMMAND@"), false);
	const quoted = renderUnit(template, {
		node: "/opt/node runtime/100%/bin/node",
		user: "lanvoryn",
		group: "lanvoryn",
	});
	assert.ok(quoted.includes('ExecStart="/opt/node runtime/100%%/bin/node"'));
	assert.throws(() =>
		renderUnit(template, {
			node: "/opt/node\nExecStart=bad",
			user: "lanvoryn",
			group: "lanvoryn",
		}),
	);
});

// 两个进程都会枚举 Linux 网卡；媒体流 ready 不能代替 WebRTC 协商验证。
test("application and media services allow interface discovery", async () => {
 const { readFile } = await import("node:fs/promises");
 for (const name of ["lanvoryn.service", "lanvoryn-media.service"]) {
  const unit = await readFile(new URL(`../deploy/${name}`, import.meta.url), "utf8");
  assert.match(unit, /^RestrictAddressFamilies=.*\bAF_NETLINK\b/m);
 }
});
