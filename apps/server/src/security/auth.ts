import {
	createHash,
	randomBytes,
	randomUUID,
	scrypt,
	timingSafeEqual,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Role, SessionInfo } from "@lanvoryn/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { atomicJson } from "../storage.js";

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
	lastActive: number;
	expires: number;
	absoluteExpires: number;
	credentialVersion: string;
}

const savedSessionsSchema = z.object({
	version: z.literal(1),
	sessions: z
		.array(
			z.object({
				tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
				id: z.string().uuid(),
				role: z.enum(["admin", "viewer"]),
				ip: z.string().max(100),
				created: z.number().finite(),
				lastActive: z.number().finite(),
				expires: z.number().finite(),
				absoluteExpires: z.number().finite(),
				credentialVersion: z.string().regex(/^[a-f0-9]{64}$/),
			}),
		)
		.max(100),
});

const digest = (value: string) =>
	createHash("sha256").update(value).digest("hex");
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
	private writing: Promise<void> = Promise.resolve();
	onRevoke: (id: string) => void = () => {};
	constructor(
		private dir: string,
		private idleHours: number,
		private secure: boolean,
		private maxHours = 720,
		private now: () => number = Date.now,
	) {}

	private credentialVersion(role: Role) {
		return digest(
			JSON.stringify(
				role === "admin" ? this.credentials.admin : this.credentials.viewer,
			),
		);
	}

	private persist() {
		const snapshot = {
			version: 1,
			sessions: [...this.sessions].map(([tokenHash, session]) => ({
				tokenHash,
				...session,
			})),
		};
		const task = this.writing
			.catch(() => {})
			.then(() => atomicJson(join(this.dir, "sessions.json"), snapshot));
		this.writing = task;
		return task;
	}

	flush() {
		return this.writing;
	}

	private cookie(reply: FastifyReply, token: string, session: Session) {
		reply.setCookie("lanvoryn_session", token, {
			path: "/",
			httpOnly: true,
			sameSite: "strict",
			secure: this.secure,
			maxAge: Math.max(0, Math.floor((session.expires - this.now()) / 1000)),
		});
	}

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
		try {
			const saved = savedSessionsSchema.parse(
				JSON.parse(await readFile(join(this.dir, "sessions.json"), "utf8")),
			);
			const now = this.now();
			for (const { tokenHash, ...session } of saved.sessions) {
				session.absoluteExpires = Math.min(
					session.absoluteExpires,
					session.created + this.maxHours * 3600000,
				);
				session.expires = Math.min(
					session.expires,
					session.lastActive + this.idleHours * 3600000,
					session.absoluteExpires,
				);
				if (
					session.created <= session.lastActive &&
					session.lastActive <= now &&
					session.expires > now &&
					session.credentialVersion === this.credentialVersion(session.role) &&
					(session.role !== "viewer" || this.credentials.viewer.enabled)
				) {
					this.sessions.set(tokenHash, session);
				}
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
		await this.persist();
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
		if (
			hash !==
				(role === "admin"
					? this.credentials.admin.hash
					: this.credentials.viewer.hash) ||
			(role === "viewer" && !this.credentials.viewer.enabled)
		)
			return null;
		const credentialVersion = this.credentialVersion(role);
		// 会话令牌仅存在于 HttpOnly Cookie 中，不交给前端持久化。
		const token = randomBytes(32).toString("base64url");
		const now = this.now();
		await this.prune();
		if (credentialVersion !== this.credentialVersion(role)) return null;
		if (this.sessions.size >= 100) {
			const oldest = this.sessions.values().next().value;
			if (oldest) this.remove(oldest.id);
		}
		const session: Session = {
			id: randomUUID(),
			role,
			ip,
			created: now,
			lastActive: now,
			expires: now + Math.min(this.idleHours, this.maxHours) * 3600000,
			absoluteExpires: now + this.maxHours * 3600000,
			credentialVersion,
		};
		const tokenHash = digest(token);
		this.sessions.set(tokenHash, session);
		try {
			await this.persist();
		} catch (error) {
			this.sessions.delete(tokenHash);
			throw error;
		}
		this.cookie(reply, token, session);
		return session;
	}

	async get(request: FastifyRequest) {
		const token = request.cookies.lanvoryn_session ?? "";
		if (!/^[\w-]{43}$/.test(token)) return undefined;
		const session = this.sessions.get(digest(token));
		if (
			session &&
			session.expires > this.now() &&
			session.absoluteExpires > this.now() &&
			session.credentialVersion === this.credentialVersion(session.role) &&
			(session.role !== "viewer" || this.credentials.viewer.enabled)
		)
			return session;
		if (session) await this.revoke(session.id);
		return undefined;
	}

	async touch(request: FastifyRequest, reply: FastifyReply) {
		const session = await this.get(request);
		const token = request.cookies.lanvoryn_session ?? "";
		if (!session || this.sessions.get(digest(token)) !== session) return false;
		const now = this.now();
		// 正在观看时会定期续期；限制写盘频率，不让状态轮询延长会话。
		if (now - session.lastActive >= 60000) {
			session.lastActive = now;
			session.expires = Math.min(
				now + this.idleHours * 3600000,
				session.absoluteExpires,
			);
			await this.persist();
		}
		this.cookie(reply, token, session);
		return true;
	}

	require = async (request: FastifyRequest, reply: FastifyReply) => {
		const session = await this.get(request);
		if (!session) return reply.code(401).send({ message: "请先登录" });
		request.session = session;
	};

	admin = async (request: FastifyRequest, reply: FastifyReply) => {
		await this.require(request, reply);
		if (!reply.sent && request.session?.role !== "admin")
			return reply.code(403).send({ message: "需要管理员权限" });
	};

	async list(current: string): Promise<SessionInfo[]> {
		await this.prune();
		return [...this.sessions.values()].map((s) => ({
			id: s.id,
			role: s.role,
			ip: s.ip,
			createdAt: new Date(s.created).toISOString(),
			expiresAt: new Date(s.expires).toISOString(),
			current: s.id === current,
		}));
	}

	private remove(id: string) {
		let removed = false;
		for (const [token, session] of this.sessions)
			if (session.id === id) {
				this.sessions.delete(token);
				removed = true;
			}
		this.onRevoke(id);
		return removed;
	}

	async revoke(id: string) {
		if (this.remove(id)) await this.persist();
	}

	async revokeRole(role: Role) {
		for (const session of [...this.sessions.values()])
			if (session.role === role) await this.revoke(session.id);
	}

	async prune() {
		for (const session of [...this.sessions.values()])
			if (
				session.expires <= this.now() ||
				session.absoluteExpires <= this.now()
			)
				await this.revoke(session.id);
	}

	async changePassword(role: Role, password: string) {
		const hash = await hashPassword(passwordSchema.parse(password));
		const updated = structuredClone(this.credentials);
		if (role === "admin") updated.admin.hash = hash;
		else updated.viewer = { enabled: true, hash };
		await atomicJson(join(this.dir, "credentials.json"), updated);
		this.credentials = updated;
		await this.revokeRole(role);
	}

	async disableViewer() {
		const updated = structuredClone(this.credentials);
		updated.viewer = { enabled: false, hash: null };
		await atomicJson(join(this.dir, "credentials.json"), updated);
		this.credentials = updated;
		await this.revokeRole("viewer");
	}
}
