import { BlockList, isIP } from "node:net";
import type { FastifyInstance } from "fastify";
import { env } from "./environment.js";

export function networkGuards(app: FastifyInstance) {
	const allowed = new BlockList();
	const rules = env.LANVORYN_ALLOWED_CIDRS.split(",")
		.map((v) => v.trim())
		.filter(Boolean);
	for (const rule of rules) {
		const [address, prefix] = rule.split("/");
		const family = isIP(address ?? "");
		if (!family) throw new Error(`无效的 CIDR：${rule}`);
		allowed.addSubnet(
			address!,
			Number(prefix ?? (family === 4 ? 32 : 128)),
			family === 4 ? "ipv4" : "ipv6",
		);
	}
	app.addHook("onRequest", async (request, reply) => {
		if (rules.length) {
			const ip = request.ip.replace(/^::ffff:/, "");
			if (!allowed.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4"))
				return reply.code(403).send({ message: "此设备的 IP 不在允许范围内" });
		}
		if (request.url.startsWith("/api/"))
			reply.header("Cache-Control", "no-store");
		if (
			["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
			request.url.startsWith("/api/")
		) {
			if (request.headers["x-lanvoryn-request"] !== "1")
				return reply.code(403).send({ message: "缺少请求校验头" });
			const origin = request.headers.origin;
			const expected =
				env.LANVORYN_PUBLIC_ORIGIN ||
				`${request.protocol}://${request.headers.host}`;
			if (origin && origin !== expected)
				return reply.code(403).send({ message: "请求来源不匹配" });
		}
	});
}
