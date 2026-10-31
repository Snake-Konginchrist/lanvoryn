import type { AppConfig, RuntimeStatus } from "@lanvoryn/shared";
import { Clock3, Plus, Trash2 } from "lucide-react";
import { locale, t } from "../i18n";
import { Field, Section, SelectField } from "./ui";

const dayNames = ["一", "二", "三", "四", "五", "六", "日"];
function uuid() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6]! & 0x0f) | 0x40;
	bytes[8] = (bytes[8]! & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function Schedules({
	config,
	onChange,
	status,
}: {
	config: AppConfig;
	onChange: (config: AppConfig) => void;
	status: RuntimeStatus | null;
}) {
	const update = (patch: Partial<AppConfig["capture"]>) =>
		onChange({ ...config, capture: { ...config.capture, ...patch } });
	const { capture } = config;
	return (
		<div className="settings-content">
			<Section
				eyebrow="ON YOUR TERMS"
				title={t("让现场按你的时间开放")}
				description={t(
					"计划控制服务器的摄像头与麦克风采集。停止时会释放设备，也会中断所有正在观看的连接。",
				)}
			>
				<div className="policy-grid">
					{(
						[
							["manual", t("手动控制"), t("由管理员开启或停止")],
							["always", t("持续开放"), t("服务启动后持续采集")],
							["schedule", t("按计划开放"), t("仅在指定每周时段内采集")],
						] as const
					).map(([value, title, description]) => (
						<button
							type="button"
							key={value}
							className={`policy-card ${capture.policy === value ? "selected" : ""}`}
							aria-pressed={capture.policy === value}
							onClick={() => update({ policy: value })}
						>
							<span className="radio-mark" />
							<strong>{title}</strong>
							<small>{description}</small>
						</button>
					))}
				</div>
				<div className="form-grid">
					<Field
						label={t("计划时区")}
						hint={t("使用 IANA 时区，例如 Asia/Shanghai、Europe/London。")}
					>
						<input
							list="timezones"
							value={capture.timezone}
							onChange={(e) => update({ timezone: e.target.value })}
						/>
						<datalist id="timezones">
							{[
								"Asia/Shanghai",
								"Asia/Tokyo",
								"Asia/Singapore",
								"Europe/London",
								"America/New_York",
								"UTC",
							].map((zone) => (
								<option key={zone} value={zone} />
							))}
						</datalist>
					</Field>
					{capture.policy === "manual" && (
						<SelectField
							label={t("手动模式保存后的状态")}
							value={String(capture.manualEnabled)}
							onChange={(e) =>
								update({ manualEnabled: e.target.value === "true" })
							}
						>
							<option value="false">{t("停止采集")}</option>
							<option value="true">{t("开始采集")}</option>
						</SelectField>
					)}
				</div>
				<div className="schedule-note">
					<Clock3 size={18} />
					<p>
						{t(
							"结束时间早于开始时间表示跨午夜，例如周一 22:00–06:00 会持续到周二早上。服务器重启后会按当前时间恢复；这不会关闭服务器电源。",
						)}
					</p>
				</div>
			</Section>
			<Section
				eyebrow="WEEKLY WINDOWS"
				title={t("每周开放时段")}
				description={t(
					"多个时段可以叠加。定时模式没有任何时段时，采集始终关闭。",
				)}
			>
				{capture.windows.map((window, index) => (
					<div className="schedule-window" key={window.id}>
						<div className="window-header">
							<span>
								{t("时段")}
								{String(index + 1).padStart(2, "0")}
							</span>
							<button
								type="button"
								className="icon-button danger"
								aria-label={t("删除时段 {{p0}}", { p0: index + 1 })}
								onClick={() =>
									update({
										windows: capture.windows.filter((w) => w.id !== window.id),
									})
								}
							>
								<Trash2 size={17} />
							</button>
						</div>
						<fieldset
							className="weekday-list"
							aria-label={t("时段 {{p0}} 的星期", { p0: index + 1 })}
						>
							{dayNames.map((name, i) => (
								<button
									type="button"
									key={name}
									aria-label={t("星期{{p0}}", { p0: t(name) })}
									aria-pressed={window.days.includes(i + 1)}
									onClick={() =>
										update({
											windows: capture.windows.map((w) =>
												w.id === window.id
													? {
															...w,
															days: w.days.includes(i + 1)
																? w.days.filter((d) => d !== i + 1)
																: [...w.days, i + 1].sort(),
														}
													: w,
											),
										})
									}
								>
									{t(name)}
								</button>
							))}
						</fieldset>
						<div className="time-range">
							<Field label={t("开始时间")}>
								<input
									type="time"
									required
									value={window.start}
									onChange={(e) =>
										update({
											windows: capture.windows.map((w) =>
												w.id === window.id
													? { ...w, start: e.target.value }
													: w,
											),
										})
									}
								/>
							</Field>
							<span>—</span>
							<Field label={t("结束时间")}>
								<input
									type="time"
									required
									value={window.end}
									onChange={(e) =>
										update({
											windows: capture.windows.map((w) =>
												w.id === window.id ? { ...w, end: e.target.value } : w,
											),
										})
									}
								/>
							</Field>
							<small>
								{window.end < window.start ? t("次日结束") : t("当日结束")}
							</small>
						</div>
					</div>
				))}
				{capture.windows.length === 0 && (
					<div className="empty-note">
						<Clock3 size={28} />
						<p>{t("还没有开放时段。为工作日、夜间或周末安排不同计划。")}</p>
					</div>
				)}
				<button
					type="button"
					className="button ghost"
					disabled={capture.windows.length >= 32}
					onClick={() =>
						update({
							windows: [
								...capture.windows,
								{
									id: uuid(),
									days: [1, 2, 3, 4, 5],
									start: "09:00",
									end: "18:00",
								},
							],
						})
					}
				>
					<Plus size={16} />
					{t("添加开放时段")}
				</button>
			</Section>
			{status?.next && (
				<div className="schedule-next">
					<Clock3 size={20} />
					<span>
						{t("已保存计划的下一次切换")}
						<strong>
							{new Date(status.next.at).toLocaleString(locale(), {
								timeZone: status.timezone,
								hour12: false,
							})}{" "}
							· {status.next.enabled ? t("开始采集") : t("停止采集")}
						</strong>
						<small>{status.timezone}</small>
					</span>
				</div>
			)}
		</div>
	);
}
