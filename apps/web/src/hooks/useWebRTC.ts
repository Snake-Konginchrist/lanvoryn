import type { PlaybackMode } from "@lanvoryn/shared";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { usePlaybackDemand } from "./usePlaybackDemand";

export interface StreamStats {
	fps: number;
	kbps: number;
	rttMs: number | null;
	packetsLost: number;
	audioLevel: number;
}
const empty: StreamStats = {
	fps: 0,
	kbps: 0,
	rttMs: null,
	packetsLost: 0,
	audioLevel: 0,
};

async function gather(peer: RTCPeerConnection, signal: AbortSignal) {
	if (peer.iceGatheringState === "complete") return;
	await new Promise<void>((resolve, reject) => {
		const finish = (error?: Error) => {
			clearTimeout(timer);
			peer.removeEventListener("icegatheringstatechange", change);
			signal.removeEventListener("abort", abort);
			if (error) reject(error);
			else resolve();
		};
		const change = () => {
			if (peer.iceGatheringState === "complete") finish();
		};
		const abort = () => finish(new DOMException("Aborted", "AbortError"));
		const timer = setTimeout(
			() => finish(new Error(t("网络候选地址收集超时"))),
			8000,
		);
		peer.addEventListener("icegatheringstatechange", change);
		signal.addEventListener("abort", abort);
		if (signal.aborted) abort();
	});
}

export function useWebRTC(mode: PlaybackMode, active: boolean) {
	const demand = usePlaybackDemand(
		mode,
		active && Boolean(window.RTCPeerConnection),
	);
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [connection, setConnection] = useState<
		"idle" | "connecting" | "connected" | "retrying"
	>("idle");
	const [error, setError] = useState<string | null>(null);
	const [stats, setStats] = useState<StreamStats>(empty);
	const [attempt, setAttempt] = useState(0);
	const peerRef = useRef<RTCPeerConnection | null>(null);

	useEffect(() => {
		setStream(null);
		setStats(empty);
		setError(null);
		if (active && !window.RTCPeerConnection) {
			setError(t("此浏览器不支持 WebRTC，请使用现代浏览器"));
			setConnection("idle");
			return;
		}
		if (!active || !demand.lease) {
			setConnection(active ? "connecting" : "idle");
			return;
		}

		const lease = demand.lease;
		const controller = new AbortController();
		const peer = new RTCPeerConnection({
			iceServers: [],
			bundlePolicy: "max-bundle",
		});
		peerRef.current = peer;
		let location: string | null = null;
		let retry: ReturnType<typeof setTimeout> | undefined;
		let statsTimer: ReturnType<typeof setInterval> | undefined;
		let previousBytes = 0;
		let previousTime = 0;
		let failures = 0;
		const scheduleRetry = (message: string) => {
			if (controller.signal.aborted || retry) return;
			setError(message);
			setConnection("retrying");
			retry = setTimeout(
				() => setAttempt((value) => value + 1),
				Math.min(10000, 2000 + attempt * 500),
			);
		};
		setConnection("connecting");
		const incoming = new MediaStream();
		peer.ontrack = (event) => {
			incoming.addTrack(event.track);
			setStream(new MediaStream(incoming.getTracks()));
		};
		peer.onconnectionstatechange = () => {
			if (controller.signal.aborted) return;
			if (peer.connectionState === "connected") {
				clearTimeout(retry);
				retry = undefined;
				setConnection("connected");
				setError(null);
			}
			if (["failed", "disconnected", "closed"].includes(peer.connectionState))
				scheduleRetry(t("媒体连接中断，正在重新连接"));
		};
		if (mode !== "audio")
			peer.addTransceiver("video", { direction: "recvonly" });
		if (mode !== "video")
			peer.addTransceiver("audio", { direction: "recvonly" });
		void (async () => {
			await peer.setLocalDescription(await peer.createOffer());
			await gather(peer, controller.signal);
			const response = await fetch("/api/whep", {
				method: "POST",
				credentials: "same-origin",
				signal: controller.signal,
				headers: {
					"Content-Type": "application/sdp",
					"X-Lanvoryn-Request": "1",
					"X-Lanvoryn-Playback": lease,
				},
				body: peer.localDescription!.sdp,
			});
			if (!response.ok) {
				if (response.status === 401)
					window.dispatchEvent(new Event("lanvoryn:unauthorized"));
				const body = await response.json().catch(() => null);
				throw new Error(
					body?.message
						? t(body.message)
						: t("播放连接失败（{{status}}）", { status: response.status }),
				);
			}
			location = response.headers.get("Location");
			await peer.setRemoteDescription({
				type: "answer",
				sdp: await response.text(),
			});
			statsTimer = setInterval(async () => {
				if (controller.signal.aborted) return;
				try {
					const reports = await peer.getStats();
					let bytes = 0;
					let timestamp = 0;
					let fps = 0;
					let packetsLost = 0;
					let audioLevel = 0;
					let rttMs: number | null = null;
					reports.forEach((report) => {
						if (report.type === "inbound-rtp") {
							bytes += report.bytesReceived ?? 0;
							timestamp = Math.max(timestamp, report.timestamp);
							fps = report.framesPerSecond ?? fps;
							packetsLost += report.packetsLost ?? 0;
							audioLevel = report.audioLevel ?? audioLevel;
						}
						if (
							report.type === "candidate-pair" &&
							report.nominated &&
							report.state === "succeeded"
						)
							rttMs =
								report.currentRoundTripTime === undefined
									? null
									: Math.round(report.currentRoundTripTime * 1000);
					});
					const kbps =
						previousTime && timestamp > previousTime
							? Math.max(
									0,
									Math.round(
										((bytes - previousBytes) * 8) / (timestamp - previousTime),
									),
								)
							: 0;
					previousBytes = bytes;
					previousTime = timestamp;
					if (!controller.signal.aborted)
						setStats({ fps, kbps, rttMs, packetsLost, audioLevel });
					if (bytes === 0 && ++failures >= 8)
						scheduleRetry(
							t("未收到媒体数据，请检查 UDP/TCP 8189 端口和服务器地址"),
						);
				} catch {
					/* 页面关闭和重连时 getStats 可能结束。 */
				}
			}, 1000);
		})().catch((cause) => {
			if (!controller.signal.aborted)
				scheduleRetry(cause instanceof Error ? cause.message : t("播放失败"));
		});
		return () => {
			controller.abort();
			clearTimeout(retry);
			clearInterval(statsTimer);
			peer.close();
			incoming.getTracks().forEach((track) => {
				track.stop();
			});
			if (peerRef.current === peer) peerRef.current = null;
			if (location)
				void fetch(location, {
					method: "DELETE",
					headers: { "X-Lanvoryn-Request": "1" },
					keepalive: true,
				}).catch(() => {});
		};
	}, [active, mode, attempt, demand.lease]);

	return {
		stream,
		connection,
		error: demand.error ?? error,
		stats,
		reconnect: () => setAttempt((value) => value + 1),
	};
}
