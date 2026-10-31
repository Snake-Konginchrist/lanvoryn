import type { PlaybackMode, RuntimeStatus } from "@lanvoryn/shared";
import {
	AudioLines,
	Camera,
	Circle,
	Expand,
	Mic,
	PictureInPicture2,
	Radio,
	RefreshCw,
	Square,
	Video,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { downloadBlob, fileStamp } from "../api";
import { useWebRTC } from "../hooks/useWebRTC";
import { t } from "../i18n";

export function Player({
	status,
	notify,
}: {
	status: RuntimeStatus;
	notify: (message: string) => void;
}) {
	const [preference, setPreference] = useState<PlaybackMode>("av");
	const [watching, setWatching] = useState(true);
	const mode: PlaybackMode = !status.video.enabled
		? "audio"
		: !status.audio.enabled
			? "video"
			: preference;
	const { stream, connection, error, stats, reconnect } = useWebRTC(
		mode,
		status.streamReady && watching,
	);
	const video = useRef<HTMLVideoElement>(null);
	const stage = useRef<HTMLDivElement>(null);
	const recorder = useRef<MediaRecorder | null>(null);
	const recordingLimit = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const [muted, setMuted] = useState(true);
	const [volume, setVolume] = useState(0.7);
	const [recording, setRecording] = useState(false);
	const [playBlocked, setPlayBlocked] = useState(false);
	const connected = connection === "connected";
	const hasVideo = mode !== "audio" && status.video.enabled;
	const hasAudio = mode !== "video" && status.audio.enabled;

	useEffect(() => {
		if (video.current) {
			video.current.srcObject = stream;
			if (stream)
				void video.current
					.play()
					.then(() => setPlayBlocked(false))
					.catch(() => setPlayBlocked(true));
		}
		return () => {
			if (recorder.current?.state === "recording") recorder.current.stop();
			clearTimeout(recordingLimit.current);
		};
	}, [stream]);
	useEffect(() => {
		if (video.current) {
			video.current.muted = muted;
			video.current.volume = volume;
		}
	}, [muted, volume]);

	async function sound() {
		if (!video.current) return;
		const next = !muted;
		video.current.muted = next;
		setMuted(next);
		try {
			await video.current.play();
			setPlayBlocked(false);
		} catch {
			notify(t("浏览器阻止了播放，请点击播放器后再试"));
		}
	}
	async function snapshot() {
		const element = video.current;
		if (!element?.videoWidth) {
			notify(t("还没有可截图的视频画面"));
			return;
		}
		const canvas = document.createElement("canvas");
		canvas.width = element.videoWidth;
		canvas.height = element.videoHeight;
		canvas.getContext("2d")!.drawImage(element, 0, 0);
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/png"),
		);
		if (blob) downloadBlob(blob, `lanvoryn-${fileStamp()}.png`);
	}
	function record() {
		if (recorder.current?.state === "recording") {
			recorder.current.stop();
			return;
		}
		if (!stream || !window.MediaRecorder) {
			notify(t("此浏览器不支持本地录制"));
			return;
		}
		const candidates = hasVideo
			? ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
			: ["audio/webm;codecs=opus", "audio/mp4"];
		const mimeType = candidates.find((type) =>
			MediaRecorder.isTypeSupported(type),
		);
		if (!mimeType) {
			notify(t("此浏览器没有可用的录制编码器"));
			return;
		}
		const chunks: Blob[] = [];
		try {
			const instance = new MediaRecorder(stream, { mimeType });
			recorder.current = instance;
			instance.ondataavailable = (event) => {
				if (event.data.size) chunks.push(event.data);
			};
			instance.onstop = () => {
				setRecording(false);
				clearTimeout(recordingLimit.current);
				if (chunks.length)
					downloadBlob(
						new Blob(chunks, { type: mimeType }),
						`lanvoryn-${fileStamp()}.${mimeType.includes("mp4") ? "mp4" : "webm"}`,
					);
				recorder.current = null;
			};
			instance.onerror = () => {
				setRecording(false);
				clearTimeout(recordingLimit.current);
				notify(t("浏览器录制失败，请检查可用内存"));
			};
			instance.start(1000);
			setRecording(true);
			recordingLimit.current = setTimeout(
				() => {
					if (instance.state === "recording") instance.stop();
				},
				10 * 60 * 1000,
			);
			notify(t("正在此设备本地录制；停止后下载，单次最多 10 分钟"));
		} catch {
			notify(t("无法启动本地录制，请更换浏览器或播放模式"));
		}
	}
	const stateText = !watching
		? t("已暂停观看")
		: !status.desired
			? t("隐私模式 · 采集已关闭")
			: !status.streamReady
				? t("等待采集信号")
				: connection === "connecting"
					? t("正在建立媒体连接")
					: connection === "retrying"
						? t("正在重新连接")
						: t("等待现场信号");

	return (
		<>
			<div className="player-top">
				<div className="live-title">
					<span className={`status-dot ${connected ? "online" : ""}`} />
					<span>{connected ? t("现场已连接") : stateText}</span>
					{status.source === "demo" && (
						<span className="badge demo">{t("合成测试源")}</span>
					)}
				</div>
				<fieldset className="segmented" aria-label={t("播放模式")}>
					{(
						[
							["av", t("音视频"), Radio],
							["video", t("仅视频"), Video],
							["audio", t("仅音频"), Mic],
						] as const
					).map(([value, label, Icon]) => (
						<button
							type="button"
							key={value}
							aria-pressed={mode === value}
							disabled={
								recording ||
								(value !== "audio" && !status.video.enabled) ||
								(value !== "video" && !status.audio.enabled)
							}
							onClick={() => setPreference(value)}
						>
							<Icon size={14} />
							{label}
						</button>
					))}
				</fieldset>
			</div>
			<div
				className={`player-stage ${connected ? "has-signal" : ""}`}
				ref={stage}
			>
				<video
					ref={video}
					autoPlay
					playsInline
					muted={muted}
					className={hasVideo ? "live-video" : "audio-element"}
					aria-label={hasVideo ? t("实时视频画面") : t("实时音频播放器")}
				/>
				{connected && hasVideo && (
					<div className="video-overlay">
						<span className="video-label">
							<span className="status-dot online" />
							{status.source === "demo" ? t("测试信号") : t("实时信号")}
						</span>
						<span>
							{status.video.width} × {status.video.height}
						</span>
					</div>
				)}
				{connected && !hasVideo && (
					<div className="audio-scene">
						<div className="audio-orb">
							<AudioLines size={66} strokeWidth={1.2} />
						</div>
						<h2>{t("仅音频")}</h2>
						<p>
							{status.source === "demo"
								? t("440 Hz 合成测试音")
								: t("正在接收现场音频")}
						</p>
						<meter
							className="audio-meter"
							aria-label={t("接收音频电平")}
							min={0}
							max={100}
							value={Math.round(stats.audioLevel * 100)}
						/>
					</div>
				)}
				{!connected && (
					<div className="player-empty">
						<div className="viewfinder">
							<span />
							<Radio size={40} strokeWidth={1} />
							<span />
						</div>
						<h2>{stateText}</h2>
						{!watching && (
							<button
								type="button"
								className="button primary"
								onClick={() => setWatching(true)}
							>
								{t("恢复观看")}
							</button>
						)}
					</div>
				)}
				{playBlocked && connected && (
					<button
						type="button"
						className="play-overlay button primary"
						onClick={() => {
							void video.current
								?.play()
								.then(() => setPlayBlocked(false))
								.catch(() => notify(t("无法播放，请检查浏览器权限")));
						}}
					>
						{t("点击开始播放")}
					</button>
				)}
				{recording && (
					<div className="recording-pill">
						<span className="status-dot recording" />
						{t("本地录制中")}
					</div>
				)}
			</div>
			<div className="player-toolbar">
				<div className="sound-controls">
					<button
						type="button"
						className="icon-button"
						onClick={() => {
							void sound();
						}}
						disabled={!connected || !hasAudio}
						aria-label={muted ? t("开启声音") : t("静音")}
					>
						{muted || !hasAudio ? <VolumeX size={18} /> : <Volume2 size={18} />}
					</button>
					<input
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={volume}
						disabled={!hasAudio}
						onChange={(e) => setVolume(Number(e.target.value))}
						aria-label={t("播放音量")}
					/>
					<span>
						{!hasAudio
							? t("无音频轨道")
							: muted
								? t("点击开启声音")
								: t("正在播放声音")}
					</span>
				</div>
				<div className="actions">
					<button
						type="button"
						className="icon-button"
						disabled={!connected || !hasVideo}
						onClick={() => {
							void snapshot();
						}}
						aria-label={t("截图")}
						title={t("截图到本机")}
					>
						<Camera size={18} />
					</button>
					<button
						type="button"
						className={`icon-button ${recording ? "is-recording" : ""}`}
						disabled={!connected}
						onClick={record}
						aria-label={recording ? t("停止录制") : t("本地录制")}
						title={t("本地录制")}
					>
						{recording ? <Square size={17} /> : <Circle size={17} />}
					</button>
					<button
						type="button"
						className="icon-button"
						disabled={!connected || !hasVideo}
						onClick={() => {
							if (!document.pictureInPictureEnabled) {
								notify(t("此浏览器不支持画中画"));
								return;
							}
							void (
								document.pictureInPictureElement
									? document.exitPictureInPicture()
									: video.current!.requestPictureInPicture()
							).catch(() => notify(t("无法打开画中画")));
						}}
						aria-label={t("画中画")}
					>
						<PictureInPicture2 size={18} />
					</button>
					<button
						type="button"
						className="icon-button"
						onClick={() => {
							void stage.current
								?.requestFullscreen?.()
								.catch(() => notify(t("此浏览器无法进入全屏")));
						}}
						aria-label={t("全屏")}
					>
						<Expand size={18} />
					</button>
					<button
						type="button"
						className="icon-button"
						onClick={reconnect}
						disabled={!watching || !status.streamReady}
						aria-label={t("重新连接")}
					>
						<RefreshCw size={17} />
					</button>
				</div>
			</div>
			{error && (
				<div className="inline-warning" role="status">
					{error}
				</div>
			)}
			<div className="stream-metrics">
				<div>
					<span>{t("接收帧率")}</span>
					<strong>
						{connected && hasVideo ? stats.fps : "—"}
						<small> FPS</small>
					</strong>
				</div>
				<div>
					<span>{t("接收码率")}</span>
					<strong>
						{connected ? stats.kbps : "—"}
						<small> kbps</small>
					</strong>
				</div>
				<div>
					<span title={t("ICE 媒体连接的往返时间，不是端到端播放延迟")}>
						{t("网络往返 RTT")}
					</span>
					<strong>
						{connected && stats.rttMs !== null ? stats.rttMs : "—"}
						<small> ms</small>
					</strong>
				</div>
				<div>
					<span>{t("累计丢包")}</span>
					<strong>
						{connected ? stats.packetsLost : "—"}
						<small> packets</small>
					</strong>
				</div>
			</div>
			<div className="player-footnote">
				<span>
					WebRTC · {hasVideo ? "H.264" : ""}
					{hasVideo && hasAudio ? " + " : ""}
					{hasAudio ? "Opus" : ""}
				</span>
				<button
					type="button"
					className="text-button"
					onClick={() => setWatching((value) => !value)}
					disabled={recording}
				>
					{watching ? t("暂停此设备观看") : t("恢复此设备观看")}
				</button>
			</div>
		</>
	);
}
