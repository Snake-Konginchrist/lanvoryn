import { BlockList, isIP } from "node:net";
import type { IpLocation } from "@lanvoryn/shared";

const special4 = new BlockList();
const special6 = new BlockList();
for (const [address, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 4],
	["240.0.0.0", 4],
] as const)
	special4.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
	["::", 96],
	["::ffff:0:0", 96],
	["64:ff9b::", 96],
	["64:ff9b:1::", 48],
	["100::", 64],
	["2001::", 23],
	["2001:db8::", 32],
	["2002::", 16],
	["3fff::", 20],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8],
] as const)
	special6.addSubnet(address, prefix, "ipv6");

export function normalizeIp(value: string): string {
	const ip = value.replace(/^::ffff:(?=\d+\.)/i, "");
	if (!isIP(ip)) return "";
	return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip;
}
export function isPublicIp(ip: string): boolean {
	const family = isIP(ip);
	return (
		!!family &&
		!(family === 4 ? special4 : special6).check(
			ip,
			family === 4 ? "ipv4" : "ipv6",
		) &&
		(family === 4 || /^[23]/.test(ip))
	);
}

export class Geolocation {
	private cache = new Map<string, { expires: number; result: IpLocation }>();
	private pending = new Map<string, Promise<IpLocation>>();
	private requests: number[] = [];
	constructor(
		private enabled: boolean,
		private request: typeof fetch = fetch,
	) {}

	async lookup(value: string): Promise<IpLocation> {
		const ip = normalizeIp(value);
		if (!ip) return { status: "unavailable" };
		if (!isPublicIp(ip)) return { status: "local" };
		if (!this.enabled) return { status: "disabled" };
		const cached = this.cache.get(ip);
		if (cached && cached.expires > Date.now()) return cached.result;
		const existing = this.pending.get(ip);
		if (existing) return existing;
		// 免费档 10 次/10 秒；留出余量，失败不阻塞认证，不自动升级付费。
		this.requests = this.requests.filter((at) => at > Date.now() - 10000);
		if (this.requests.length >= 8) return { status: "unavailable" };
		this.requests.push(Date.now());
		const task = this.query(ip)
			.then((result) => {
				if (this.cache.size >= 1000)
					this.cache.delete(this.cache.keys().next().value!);
				this.cache.set(ip, {
					result,
					expires:
						Date.now() + (result.status === "located" ? 86400000 : 60000),
				});
				return result;
			})
			.finally(() => this.pending.delete(ip));
		this.pending.set(ip, task);
		return task;
	}
	private async query(ip: string): Promise<IpLocation> {
		try {
			const response = await this.request(
				`https://free.freeipapi.com/api/v1/json/${encodeURIComponent(ip)}`,
				{
					signal: AbortSignal.timeout(2500),
					redirect: "error",
				},
			);
			if (!response.ok) return { status: "unavailable" };
			const data = (await response.json()) as Record<string, unknown>;
			if (
				normalizeIp(String(data.ipAddress ?? "")) !== ip ||
				!/^[A-Z]{2}$/.test(String(data.countryCode))
			)
				return { status: "unavailable" };
			const text = (key: string) =>
				typeof data[key] === "string" ? data[key].slice(0, 120) : "";
			return {
				status: "located",
				countryCode: text("countryCode"),
				region: text("regionName"),
				city: text("cityName"),
			};
		} catch {
			return { status: "unavailable" };
		}
	}
}
