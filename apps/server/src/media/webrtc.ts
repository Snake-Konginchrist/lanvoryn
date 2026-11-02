import { randomUUID } from "node:crypto";
import { env } from "../environment.js";

interface Reader {
	owner: string;
	location: string;
}

export class WebRTC {
	private readers = new Map<string, Reader>();
	get count() {
		return this.readers.size;
	}

	async offer(owner: string, sdp: string) {
		if (
			this.readers.size >= 32 ||
			[...this.readers.values()].filter((r) => r.owner === owner).length >= 4
		)
			throw Object.assign(new Error("播放会话已达上限，请关闭其他播放页面"), {
				statusCode: 429,
			});
		const response = await fetch(`${env.LANVORYN_MEDIAMTX_WEBRTC}/live/whep`, {
			method: "POST",
			headers: { "Content-Type": "application/sdp" },
			body: sdp,
			signal: AbortSignal.timeout(10000),
			redirect: "error",
		});
		if (!response.ok)
			throw Object.assign(
				new Error("流尚未就绪，或 WebRTC 协商失败，请检查采集状态"),
				{ statusCode: 503 },
			);
		const location = new URL(
			response.headers.get("location") ?? "",
			`${env.LANVORYN_MEDIAMTX_WEBRTC}/live/whep`,
		);
		if (
			location.origin !== new URL(env.LANVORYN_MEDIAMTX_WEBRTC).origin ||
			!location.pathname.startsWith("/live/whep/")
		)
			throw new Error("MediaMTX 返回了无效的会话地址");
		const answer = await response.text();
		const id = randomUUID();
		this.readers.set(id, { owner, location: location.href });
		return { id, answer };
	}

	async remove(id: string, owner?: string) {
		const reader = this.readers.get(id);
		if (!reader || (owner && owner !== reader.owner)) return;
		this.readers.delete(id);
		try {
			await fetch(reader.location, {
				method: "DELETE",
				signal: AbortSignal.timeout(2000),
				redirect: "error",
			});
		} catch {
			/* 重启或关闭后的会话可能已经由 MediaMTX 清理。 */
		}
	}

	async revokeOwner(owner: string) {
		await Promise.all(
			[...this.readers]
				.filter(([, reader]) => reader.owner === owner)
				.map(([id]) => this.remove(id)),
		);
	}

	async closeAll() {
		await Promise.all([...this.readers.keys()].map((id) => this.remove(id)));
	}

	async prune() {
		try {
			const response = await fetch(
				`${env.LANVORYN_MEDIAMTX_API}/v3/webrtcsessions/list?itemsPerPage=100`,
				{ signal: AbortSignal.timeout(1500) },
			);
			if (!response.ok) return;
			const data = (await response.json()) as { items: { id: string }[] };
			const active = new Set(data.items.map((item) => item.id));
			for (const [id, reader] of this.readers) {
				const upstreamId = new URL(reader.location).pathname.split("/").at(-1)!;
				if (!active.has(upstreamId)) this.readers.delete(id);
			}
		} catch {
			/* 暂时失联不误删仍可能存活的连接。 */
		}
	}
}
