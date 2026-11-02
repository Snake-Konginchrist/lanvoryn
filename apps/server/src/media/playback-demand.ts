import type { PlaybackMode } from "@lanvoryn/shared";

interface Lease {
	owner: string;
	mode: PlaybackMode;
	expires: number;
}

/** 播放需求独立于 WebRTC 重连，避免重连时设备反复启停。 */
export class PlaybackDemand {
	private leases = new Map<string, Lease>();
	constructor(private now = Date.now) {}
	prune() {
		for (const [id, lease] of this.leases)
			if (lease.expires <= this.now()) this.leases.delete(id);
	}
	has(id: string, owner: string) {
		this.prune();
		return this.leases.get(id)?.owner === owner;
	}
	mode(id: string, owner: string) {
		return this.has(id, owner) ? this.leases.get(id)!.mode : undefined;
	}
	renew(id: string, owner: string, mode: PlaybackMode) {
		this.prune();
		const old = this.leases.get(id);
		if (old && old.owner !== owner) return false;
		if (
			!old &&
			(this.leases.size >= 32 ||
				[...this.leases.values()].filter((l) => l.owner === owner).length >= 4)
		)
			return false;
		this.leases.set(id, { owner, mode, expires: this.now() + 30000 });
		return true;
	}
	remove(id: string, owner: string) {
		if (this.leases.get(id)?.owner === owner) this.leases.delete(id);
	}
	revokeOwner(owner: string) {
		for (const [id, lease] of this.leases)
			if (lease.owner === owner) this.leases.delete(id);
	}
	clear() {
		this.leases.clear();
	}
	get inputs() {
		this.prune();
		const modes = [...this.leases.values()].map((l) => l.mode);
		return {
			video: modes.some((m) => m !== "audio"),
			audio: modes.some((m) => m !== "video"),
		};
	}
}
