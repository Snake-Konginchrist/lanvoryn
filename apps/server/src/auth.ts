import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Role, SessionInfo } from "@lanvoryn/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { atomicJson } from "./storage.js";

const credentialsSchema = z.object({
	admin: z.object({ username: z.string().min(1), hash: z.string().min(20) }),
	viewer: z.object({ enabled: z.boolean(), hash: z.string().nullable() }),
});
export type Credentials = z.infer<typeof credentialsSchema>;
export interface Session {
	id: string;
	role: Role;
	ip: string;
	created: number;
	expires: number;
}
declare module "fastify" {
	interface FastifyRequest {
		session?: Session;
	}
}

export function derive(password: string, salt: string): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scrypt(
			password,
			salt,
			32,
			{ N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
			(error, key) => (error ? reject(error) : resolve(key)),
		),
	);
}
export async function hashPassword(password: string) {
	const salt = randomBytes(16).toString("hex");
	return `scrypt:32768:${salt}:${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
	const [algorithm, cost, salt, expected] = hash.split(":");
	if (algorithm !== "scrypt" || cost !== "32768" || !salt || !expected)
		return false;
	const actual = await derive(password, salt);
	const key = Buffer.from(expected, "hex");
	return key.length === actual.length && timingSafeEqual(key, actual);
}

export const passwordSchema = z
	.string()
	.min(12, "密码至少需要 12 个字符")
	.max(128);

export class Auth {
	credentials!: Credentials;
	private sessions = new Map<string, Session>();
	private dummyHash = "";
	onRevoke: (id: string) => void = () => {};
	constructor(
		private dir: string,
		private hours: number,
		private secure: boolean,
	) {}

	async init() {
		try {
			this.credentials = credentialsSchema.parse(
				JSON.parse(await readFile(join(this.dir, "credentials.json"), "utf8")),
			);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT")
				throw new Error("尚未设置管理员密码。请先运行 npm run setup。");
			throw error;
		}
		this.dummyHash = await hashPassword(randomBytes(32).toString("hex"));
	}

	async login(
		username: string,
		password: string,
		ip: string,
		reply: FastifyReply,
	) {
		const role =
			username === this.credentials.admin.username
				? "admin"
				: username === "viewer"
					? "viewer"
					: null;
		const hash =
			role === "admin"
				? this.credentials.admin.hash
				: role === "viewer" && this.credentials.viewer.enabled
					? this.credentials.viewer.hash
					: null;
		const valid = await verifyPassword(password, hash ?? this.dummyHash);
		if (!valid || !hash || !role) return null;
		// 会话令牌仅存在于 HttpOnly Cookie 中，不交给前端持久化。
		const token = randomBytes(32).toString("base64url");
		const now = Date.now();
		this.prune();
		if (this.sessions.size >= 100) {
			const oldest = this.sessions.values().next().value;
			if (oldest) this.revoke(oldest.id);
		}
		const session: Session = {
			id: randomUUID(),
			role,
			ip,
			created: now,
			expires: now + this.hours * 3600000,
		};
		this.sessions.set(token, session);
		reply.setCookie("lanvoryn_session", token, {
			path: "/",
			httpOnly: true,
			sameSite: "strict",
			secure: this.secure,
			maxAge: this.hours * 3600,
		});
		return session;
	}

	get(request: FastifyRequest) {
		const session = this.sessions.get(request.cookies.lanvoryn_session ?? "");
		if (session && session.expires > Date.now()) return session;
		if (session) this.revoke(session.id);
		return undefined;
	}

	require = async (request: FastifyRequest, reply: FastifyReply) => {
		const session = this.get(request);
		if (!session) return reply.code(401).send({ message: "请先登录" });
		request.session = session;
	};

	admin = async (request: FastifyRequest, reply: FastifyReply) => {
		await this.require(request, reply);
		if (!reply.sent && request.session?.role !== "admin")
			return reply.code(403).send({ message: "需要管理员权限" });
	};

	list(current: string): SessionInfo[] {
		this.prune();
		return [...this.sessions.values()].map((s) => ({
			id: s.id,
			role: s.role,
			ip: s.ip,
			createdAt: new Date(s.created).toISOString(),
			expiresAt: new Date(s.expires).toISOString(),
			current: s.id === current,
		}));
	}

	revoke(id: string) {
		for (const [token, session] of this.sessions)
			if (session.id === id) this.sessions.delete(token);
		this.onRevoke(id);
	}

	revokeRole(role: Role) {
		for (const session of [...this.sessions.values()])
			if (session.role === role) this.revoke(session.id);
	}

	prune() {
		for (const session of [...this.sessions.values()])
			if (session.expires <= Date.now()) this.revoke(session.id);
	}

	async changePassword(role: Role, password: string) {
		const hash = await hashPassword(passwordSchema.parse(password));
		const updated = structuredClone(this.credentials);
		if (role === "admin") updated.admin.hash = hash;
		else updated.viewer = { enabled: true, hash };
		await atomicJson(join(this.dir, "credentials.json"), updated);
		this.credentials = updated;
		this.revokeRole(role);
	}

	async disableViewer() {
		const updated = structuredClone(this.credentials);
		updated.viewer = { enabled: false, hash: null };
		await atomicJson(join(this.dir, "credentials.json"), updated);
		this.credentials = updated;
		this.revokeRole("viewer");
	}
}
