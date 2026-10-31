import { type AppConfig, type Devices, presets } from "@lanvoryn/shared";
import { Cpu, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { t } from "../i18n";
import { Field, NumberField, Section, SelectField, Toggle } from "./ui";

interface Props {
	config: AppConfig;
	onChange: (config: AppConfig) => void;
	notify: (message: string) => void;
}
export function Settings({ config, onChange, notify }: Props) {
	const [devices, setDevices] = useState<Devices | null>(null);
	const [deviceError, setDeviceError] = useState("");
	const [refreshKey, refresh] = useState(0);
	const [busyControl, setBusyControl] = useState<string | null>(null);
	const video = (patch: Partial<AppConfig["video"]>) =>
		onChange({ ...config, video: { ...config.video, ...patch } });
	const audio = (patch: Partial<AppConfig["audio"]>) =>
		onChange({ ...config, audio: { ...config.audio, ...patch } });
	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey 是用户主动重新检测设备的失效标记。
	useEffect(() => {
		let current = true;
		setDeviceError("");
		void api<Devices>(
			`/devices?device=${encodeURIComponent(config.video.device)}`,
		)
			.then((data) => {
				if (current) setDevices(data);
			})
			.catch((error) => {
				if (current) setDeviceError(error.message);
			});
		return () => {
			current = false;
		};
	}, [config.video.device, refreshKey]);

	return (
		<div className="settings-content">
			<Section
				eyebrow="CAPTURE IDENTITY"
				title={t("给现场一个名字")}
				description={t("显示在所有观看设备的控制台中。")}
			>
				<Field label={t("现场名称")}>
					<input
						maxLength={48}
						value={config.name}
						onChange={(e) => onChange({ ...config, name: e.target.value })}
					/>
				</Field>
			</Section>
			<Section
				eyebrow="VIDEO INPUT"
				title={t("视频采集")}
				description={t(
					"选择设备支持的分辨率与帧率组合。保存后，现有观看设备会重新连接。",
				)}
			>
				<Toggle
					label={t("启用摄像头")}
					checked={config.video.enabled}
					onChange={(enabled) => video({ enabled })}
				/>
				<div className="preset-grid">
					{Object.entries(presets).map(([key, preset]) => (
						<button
							type="button"
							key={key}
							className={`preset ${config.video.width === preset.width && config.video.height === preset.height ? "selected" : ""}`}
							onClick={() => video(preset)}
						>
							<span>
								{
									{
										fluent: t("流畅优先"),
										balanced: t("清晰均衡"),
										detailed: t("细节优先"),
									}[key]
								}
							</span>
							<strong>
								{preset.height === 2160 ? "4K" : `${preset.height}p`}
							</strong>
							<small>
								{preset.fps} FPS · {preset.bitrateKbps / 1000} Mbps
							</small>
						</button>
					))}
				</div>
				<div className="form-grid">
					<SelectField
						label={t("视频设备")}
						value={config.video.device}
						onChange={(e) => video({ device: e.target.value })}
					>
						{!devices?.cameras.some((c) => c.path === config.video.device) && (
							<option value={config.video.device}>{config.video.device}</option>
						)}
						{devices?.cameras.map((c) => (
							<option key={c.path} value={c.path}>
								{c.name} · {c.path}
							</option>
						))}
					</SelectField>
					<SelectField
						label={t("输入格式")}
						value={config.video.inputFormat}
						onChange={(e) =>
							video({
								inputFormat: e.target
									.value as AppConfig["video"]["inputFormat"],
							})
						}
					>
						<option value="mjpeg">{t("MJPEG（优先）")}</option>
						<option value="yuyv422">{t("YUYV（原始像素）")}</option>
					</SelectField>
					<NumberField
						label={t("画面宽度 / px")}
						min={160}
						max={7680}
						step={2}
						value={config.video.width}
						onChange={(e) => video({ width: Number(e.target.value) })}
					/>
					<NumberField
						label={t("画面高度 / px")}
						min={120}
						max={4320}
						step={2}
						value={config.video.height}
						onChange={(e) => video({ height: Number(e.target.value) })}
					/>
					<NumberField
						label={t("目标帧率 / FPS")}
						min={1}
						max={120}
						value={config.video.fps}
						onChange={(e) => video({ fps: Number(e.target.value) })}
					/>
					<NumberField
						label={t("视频码率 / kbps")}
						min={256}
						max={50000}
						step={100}
						value={config.video.bitrateKbps}
						onChange={(e) => video({ bitrateKbps: Number(e.target.value) })}
					/>
					<SelectField
						label={t("H.264 编码器")}
						hint={t(
							"列出编码器不代表硬件实际可用；失败时会显示错误，不会静默降级。",
						)}
						value={config.video.encoder}
						onChange={(e) =>
							video({
								encoder: e.target.value as AppConfig["video"]["encoder"],
							})
						}
					>
						<option value="libx264">CPU · libx264</option>
						<option value="h264_nvenc">NVIDIA · NVENC</option>
					</SelectField>
					<NumberField
						label={t("关键帧间隔 / 秒")}
						min={1}
						max={5}
						value={config.video.keyframeSeconds}
						onChange={(e) => video({ keyframeSeconds: Number(e.target.value) })}
					/>
					<SelectField
						label={t("画面旋转")}
						value={config.video.rotation}
						onChange={(e) =>
							video({
								rotation: e.target.value as AppConfig["video"]["rotation"],
							})
						}
					>
						{["0", "90", "180", "270"].map((value) => (
							<option key={value} value={value}>
								{value}°
							</option>
						))}
					</SelectField>
					<Toggle
						label={t("水平镜像")}
						checked={config.video.mirror}
						onChange={(mirror) => video({ mirror })}
					/>
				</div>
				{devices?.modes.length ? (
					<details className="device-details">
						<summary>
							<SlidersHorizontal size={16} />
							{t("设备报告的采集能力（")}
							{devices.modes.length}
							{t("组）")}
						</summary>
						<div className="capability-list">
							{devices.modes.map((m) => (
								<span key={`${m.inputFormat}-${m.width}-${m.height}`}>
									{m.width} × {m.height} · {m.inputFormat} · {m.fps.join(" / ")}{" "}
									FPS
								</span>
							))}
						</div>
					</details>
				) : null}
			</Section>
			<Section
				eyebrow="AUDIO INPUT"
				title={t("音频采集")}
				description={t(
					"Opus 编码用于浏览器低延迟播放。采集增益影响所有观看者，播放器音量只影响当前设备。",
				)}
			>
				<Toggle
					label={t("启用麦克风")}
					checked={config.audio.enabled}
					onChange={(enabled) => audio({ enabled })}
				/>
				<div className="form-grid">
					<SelectField
						label={t("录音设备")}
						value={config.audio.device}
						onChange={(e) => audio({ device: e.target.value })}
					>
						{!devices?.microphones.some(
							(m) => m.id === config.audio.device,
						) && (
							<option value={config.audio.device}>{config.audio.device}</option>
						)}
						{devices?.microphones.map((m) => (
							<option value={m.id} key={m.id}>
								{m.name} · {m.id}
							</option>
						))}
					</SelectField>
					<SelectField
						label={t("输入采样率")}
						value={config.audio.sampleRate}
						onChange={(e) =>
							audio({
								sampleRate: e.target.value as AppConfig["audio"]["sampleRate"],
							})
						}
					>
						{["16000", "32000", "48000"].map((rate) => (
							<option key={rate} value={rate}>
								{Number(rate) / 1000} kHz
							</option>
						))}
					</SelectField>
					<SelectField
						label={t("声道")}
						value={config.audio.channels}
						onChange={(e) =>
							audio({ channels: Number(e.target.value) as 1 | 2 })
						}
					>
						<option value={1}>{t("单声道")}</option>
						<option value={2}>{t("双声道")}</option>
					</SelectField>
					<NumberField
						label={t("音频码率 / kbps")}
						min={16}
						max={256}
						value={config.audio.bitrateKbps}
						onChange={(e) => audio({ bitrateKbps: Number(e.target.value) })}
					/>
					<NumberField
						label={t("采集增益 / dB")}
						min={-30}
						max={20}
						value={config.audio.gainDb}
						onChange={(e) => audio({ gainDb: Number(e.target.value) })}
						hint={t("0 dB 保持原始音量，正值会放大噪声。")}
					/>
					<NumberField
						label={t("音画补偿 / ms")}
						min={-2000}
						max={2000}
						step={10}
						value={config.audio.offsetMs}
						onChange={(e) => audio({ offsetMs: Number(e.target.value) })}
						hint={t("正值延后声音；负值延后画面。需要实际测量后调整。")}
					/>
					<Toggle
						label={t("环境降噪")}
						hint={t("使用 FFmpeg 频域降噪，可能改变音色。")}
						checked={config.audio.noiseSuppression}
						onChange={(noiseSuppression) => audio({ noiseSuppression })}
					/>
					<Toggle
						label={t("过滤低频杂音")}
						hint={t("100 Hz 高通滤波。")}
						checked={config.audio.highpass}
						onChange={(highpass) => audio({ highpass })}
					/>
				</div>
			</Section>
			<Section
				eyebrow="DEVICE CONTROLS"
				title={t("摄像头硬件控制")}
				description={t(
					"直接读取设备支持的亮度、曝光、对焦等控制项；这里的更改立即生效，断电后可能由设备复位。",
				)}
			>
				<button
					type="button"
					className="button ghost"
					onClick={() => refresh((value) => value + 1)}
				>
					<RefreshCw size={15} />
					{t("重新检测设备")}
				</button>
				{deviceError && <p className="form-error">{deviceError}</p>}
				{devices?.warnings.map((message) => (
					<p className="inline-warning" key={message}>
						{message}
					</p>
				))}
				{devices?.controls.length ? (
					<div className="form-grid controls-grid">
						{devices.controls.map((control) => (
							<Field
								key={control.name}
								label={control.name}
								hint={
									control.readOnly
										? t("设备报告为只读或当前不可调")
										: t("默认 {{p0}} · 范围 {{p1}}–{{p2}}", {
												p0: control.default,
												p1: control.min,
												p2: control.max,
											})
								}
							>
								<div className="control-input">
									{Object.keys(control.menu).length ? (
										<select
											aria-label={control.name}
											value={control.value}
											disabled={control.readOnly || busyControl !== null}
											onChange={(e) =>
												setDevices({
													...devices,
													controls: devices.controls.map((c) =>
														c.name === control.name
															? { ...c, value: Number(e.target.value) }
															: c,
													),
												})
											}
										>
											{Object.entries(control.menu).map(([key, label]) => (
												<option value={key} key={key}>
													{label}
												</option>
											))}
										</select>
									) : (
										<input
											aria-label={control.name}
											type="number"
											value={control.value}
											min={control.min}
											max={control.max}
											step={control.step}
											disabled={control.readOnly || busyControl !== null}
											onChange={(e) =>
												setDevices({
													...devices,
													controls: devices.controls.map((c) =>
														c.name === control.name
															? { ...c, value: Number(e.target.value) }
															: c,
													),
												})
											}
										/>
									)}
									<button
										type="button"
										className="button ghost"
										disabled={
											control.readOnly ||
											busyControl !== null ||
											config.video.device.length === 0
										}
										onClick={() => {
											setBusyControl(control.name);
											void api("/devices/control", {
												method: "PUT",
												body: { name: control.name, value: control.value },
											})
												.then(() => {
													notify(t("硬件控制项已应用"));
													refresh((v) => v + 1);
												})
												.catch((error) => notify(error.message))
												.finally(() => setBusyControl(null));
										}}
									>
										{t("应用")}
									</button>
								</div>
							</Field>
						))}
					</div>
				) : (
					<div className="empty-note">
						<Cpu size={22} />
						<p>
							{devices?.source === "demo"
								? t(
										"测试源没有硬件控制项。切换到 Linux 真机后，这里会显示设备实际支持的参数。",
									)
								: t("当前未读取到可用的硬件控制项。")}
						</p>
					</div>
				)}
			</Section>
		</div>
	);
}
