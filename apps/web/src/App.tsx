import {
	type AppConfig,
	type ConfigDocument,
	configSchema,
	type Role,
	type RuntimeStatus,
} from "@lanvoryn/shared";
import {
	ArrowUpRight,
	AudioLines,
	Check,
	ChevronRight,
	Clock3,
	Copy,
	ExternalLink,
	FileText,
	LogOut,
	Menu,
	Monitor,
	Play,
	Radio,
	RotateCw,
	Settings2,
	ShieldCheck,
	Square,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "./api";
import { ConfigTransfer } from "./components/ConfigTransfer";
import { Events } from "./components/Events";
import { LanguageSwitch } from "./components/LanguageSwitch";
import { Login } from "./components/Login";
import { Player } from "./components/Player";
import { Schedules } from "./components/Schedules";
import { Security } from "./components/Security";
import { Settings } from "./components/Settings";
import { ThemeSwitch } from "./components/ThemeSwitch";
import { SaveBar } from "./components/ui";
import { locale, t, translateMessage } from "./i18n";

type Page = "live" | "settings" | "schedules" | "security" | "events";
const navigation = [
	{ id: "live", title: "实时监看", icon: Monitor },
	{
		id: "settings",
		title: "采集参数",
		icon: Settings2,
	},
	{
		id: "schedules",
		title: "定时计划",
		icon: Clock3,
	},
	{
		id: "security",
		title: "访问安全",
		icon: ShieldCheck,
	},
	{
		id: "events",
		title: "运行日志",
		icon: FileText,
	},
] as const;

async function copyAddress(text: string) {
	if (navigator.clipboard) {
		await navigator.clipboard.writeText(text);
		return;
	}
	const field = window.document.createElement("textarea");
	field.value = text;
	field.style.position = "fixed";
	field.style.opacity = "0";
	window.document.body.append(field);
	field.select();
	const copied = window.document.execCommand("copy");
	field.remove();
	if (!copied) throw new Error(t("浏览器不允许复制，请手动复制地址"));
}

export default function App() {
	useTranslation();
	const [role, setRole] = useState<Role | null | undefined>(undefined);
	const [page, setPage] = useState<Page>("live");
	const [sidebar, setSidebar] = useState(false);
	const [status, setStatus] = useState<RuntimeStatus | null>(null);
	const [saved, setSaved] = useState<ConfigDocument | null>(null);
	const [draft, setDraft] = useState<AppConfig | null>(null);
	const [busy, setBusy] = useState(false);
	const [loadError, setLoadError] = useState("");
	const [notice, setNotice] = useState("");
	const notify = (message: string) => setNotice(message);
	const logoutLocal = useCallback(() => {
		setRole(null);
		setStatus(null);
		setSaved(null);
		setDraft(null);
		setPage("live");
	}, []);

	useEffect(() => {
		const expired = () => {
			logoutLocal();
			setNotice(t("登录已结束，请重新登录"));
		};
		window.addEventListener("lanvoryn:unauthorized", expired);
		void api<{ role: Role }>("/auth/me")
			.then((result) => setRole(result.role))
			.catch(() => setRole(null));
		return () => window.removeEventListener("lanvoryn:unauthorized", expired);
	}, [logoutLocal]);
	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(() => setNotice(""), 6000);
		return () => clearTimeout(timer);
	}, [notice]);
	useEffect(() => {
		if (!role) return;
		let active = true;
		let pending = false;
		const load = async () => {
			if (pending) return;
			pending = true;
			try {
				const next = await api<RuntimeStatus>("/status");
				if (active) {
					setStatus(next);
					setLoadError("");
				}
			} catch (error) {
				if (active)
					setLoadError(
						error instanceof Error ? error.message : t("无法读取运行状态"),
					);
			} finally {
				pending = false;
			}
		};
		void load();
		if (role === "admin")
			void api<ConfigDocument>("/config")
				.then((result) => {
					if (active) {
						setSaved(result);
						setDraft(structuredClone(result.config));
					}
				})
				.catch((error) => {
					if (active) setLoadError(error.message);
				});
		const timer = setInterval(() => {
			void load();
		}, 3000);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [role]);

	const run = async (task: () => Promise<void>) => {
		setBusy(true);
		try {
			await task();
		} catch (error) {
			notify(error instanceof Error ? error.message : t("操作失败"));
		} finally {
			setBusy(false);
		}
	};
	const refreshStatus = async () =>
		setStatus(await api<RuntimeStatus>("/status"));
	const save = () => {
		void run(async () => {
			if (!saved || !draft) return;
			const parsed = configSchema.safeParse(draft);
			if (!parsed.success)
				throw new Error(
					parsed.error.issues.map((issue) => t(issue.message)).join("；"),
				);
			const result = await api<ConfigDocument>("/config", {
				method: "PUT",
				body: { revision: saved.revision, config: parsed.data },
			});
			setSaved(result);
			setDraft(structuredClone(result.config));
			notify(t("配置已保存并应用"));
			await refreshStatus();
		});
	};
	const control = (action: "start" | "stop" | "restart") => {
		void run(async () => {
			const result = await api<ConfigDocument>(`/capture/${action}`, {
				method: "POST",
			});
			setSaved(result);
			setDraft((previous) =>
				previous
					? { ...previous, capture: structuredClone(result.config.capture) }
					: structuredClone(result.config),
			);
			notify(
				action === "stop"
					? t("采集已停止，所有观看连接已断开")
					: action === "start"
						? t("已切换到手动模式，正在启动采集")
						: t("已请求重新启动采集"),
			);
			await refreshStatus();
		});
	};
	const toast = notice && (
		<div className="toast" role="status">
			<Check size={17} />
			<span>{notice}</span>
			<button
				type="button"
				aria-label={t("关闭提示")}
				onClick={() => setNotice("")}
			>
				<X size={15} />
			</button>
		</div>
	);
	if (role === undefined)
		return (
			<main className="loading-screen">
				<Radio size={32} />
				<p>{t("正在连接你的现场…")}</p>
			</main>
		);
	if (!role)
		return (
			<>
				<Login onLogin={setRole} />
				{toast}
			</>
		);
	const current = navigation.find((item) => item.id === page)!;
	const dirty = Boolean(
		saved && draft && JSON.stringify(saved.config) !== JSON.stringify(draft),
	);
	const address = status?.addresses[0] ?? window.location.origin;
	const captureLabel =
		status?.state === "running" && status.streamReady
			? t("采集中")
			: {
					stopped: t("采集已停止"),
					starting: t("启动中"),
					retrying: t("故障重试中"),
					running: t("等待媒体就绪"),
					error: t("采集故障"),
				}[status?.state ?? "stopped"];

	return (
		<div className="app-shell">
			{sidebar && (
				<button
					type="button"
					className="sidebar-backdrop"
					aria-label={t("关闭导航")}
					onClick={() => setSidebar(false)}
				/>
			)}
			<aside className={`sidebar ${sidebar ? "open" : ""}`}>
				<a className="brand" href="/" aria-label={t("Lanvoryn 首页")}>
					<Radio size={29} />
					<span>Lanvoryn</span>
				</a>
				<div className="workspace-label">
					<span className="tiny-dot" />
					{t("你的私有现场")}
				</div>
				<nav aria-label={t("主要导航")}>
					{navigation
						.filter((item) => role === "admin" || item.id === "live")
						.map((item) => (
							<button
								type="button"
								key={item.id}
								aria-current={page === item.id ? "page" : undefined}
								className={page === item.id ? "active" : ""}
								onClick={() => {
									setPage(item.id);
									setSidebar(false);
								}}
							>
								<item.icon size={19} />
								<span>{t(item.title)}</span>
								{page === item.id && <ChevronRight size={15} />}
							</button>
						))}
				</nav>
				<div className="sidebar-bottom">
					<div className="account-row">
						<span className="avatar">{role === "admin" ? "A" : "V"}</span>
						<span>
							<strong>{role === "admin" ? t("管理员") : t("只读访客")}</strong>
							<small>{status?.hostname ?? t("连接中")}</small>
						</span>
						<button
							type="button"
							className="icon-button"
							aria-label={t("退出登录")}
							onClick={() => {
								void run(async () => {
									await api("/auth/logout", { method: "POST" });
									logoutLocal();
								});
							}}
						>
							<LogOut size={17} />
						</button>
					</div>
				</div>
			</aside>
			<div className="main-shell">
				<header className="topbar">
					<div className="breadcrumb">
						<button
							type="button"
							className="icon-button mobile-menu"
							aria-label={t("打开导航")}
							onClick={() => setSidebar(true)}
						>
							<Menu size={21} />
						</button>
						<span>{t("我的空间")}</span>
						<ChevronRight size={13} />
						<strong>{t(current.title)}</strong>
					</div>
					<div className="topbar-right">
						<ThemeSwitch />
						<LanguageSwitch />
						<span className="private-badge">
							<ShieldCheck size={13} />
							{t("密码保护")}
						</span>
						<span className="mono">v0.1.0</span>
					</div>
				</header>
				<main className="main-content">
					<div className="page-heading">
						<div>
							<h1>{t(current.title)}</h1>
							{page === "live" && status?.name && <p>{status.name}</p>}
						</div>
						{page === "live" && role === "admin" && (
							<button
								type="button"
								className={`button ${status?.desired ? "privacy-button" : "primary"}`}
								disabled={busy || !status}
								onClick={() => control(status?.desired ? "stop" : "start")}
							>
								{status?.desired ? <Square size={15} /> : <Play size={16} />}
								{status?.desired ? t("隐私停止") : t("开始采集")}
							</button>
						)}
					</div>
					{loadError && (
						<div className="inline-warning" role="alert">
							{loadError}
							<button
								type="button"
								className="text-button"
								onClick={() => {
									void run(refreshStatus);
								}}
							>
								{t("重新加载")}
							</button>
						</div>
					)}
					{status?.source === "demo" && (
						<div className="demo-banner">
							<Radio size={16} />
							<span>
								{t(
									"当前为演示测试源：画面由程序生成，声音为 440 Hz 测试音，未连接真实摄像头或麦克风。",
								)}
							</span>
						</div>
					)}
					{page === "live" && (
						<div className="monitor-grid">
							<section className="monitor-panel panel">
								{status ? (
									<Player status={status} notify={notify} />
								) : (
									<div className="empty-note">{t("正在读取采集状态…")}</div>
								)}
							</section>
							<aside className="monitor-aside">
								<section className="signal-card panel">
									<div className="card-title">
										<Radio size={18} />
									</div>
									<h2>{status?.name ?? t("我的局域网现场")}</h2>
									<span
										className={`signal-state ${status?.streamReady ? "online" : ""}`}
									>
										<span
											className={`status-dot ${status?.streamReady ? "online" : ""}`}
										/>
										{captureLabel}
									</span>
									<dl className="signal-details">
										<div>
											<dt>{t("目标画质")}</dt>
											<dd>
												{status?.video.enabled
													? `${status.video.width} × ${status.video.height}`
													: t("未启用视频")}
											</dd>
										</div>
										<div>
											<dt>{t("目标帧率")}</dt>
											<dd>
												{status?.video.enabled
													? `${status.video.fps} FPS`
													: "—"}
											</dd>
										</div>
										<div>
											<dt>{t("编码方式")}</dt>
											<dd>
												{status?.video.enabled
													? status.video.encoder === "h264_nvenc"
														? "NVIDIA H.264"
														: "CPU H.264"
													: t("仅音频")}
											</dd>
										</div>
										<div>
											<dt>{t("音频输入")}</dt>
											<dd>
												{status?.audio.enabled
													? t("Opus - {{p0}}声道", {
															p0:
																status.audio.channels === 2 ? t("双") : t("单"),
														})
													: t("未启用")}
											</dd>
										</div>
										<div>
											<dt>{t("播放会话")}</dt>
											<dd>
												<Users size={13} />
												{status?.viewers ?? 0} / 32
											</dd>
										</div>
										<div>
											<dt>{t("采集策略")}</dt>
											<dd>
												{
													{
														manual: t("手动控制"),
														always: t("持续开放"),
														schedule: t("按计划开放"),
													}[status?.policy ?? "manual"]
												}
											</dd>
										</div>
									</dl>
									{role === "admin" && (
										<button
											type="button"
											className="text-button signal-link"
											onClick={() => setPage("settings")}
										>
											{t("调整采集参数")}
											<ArrowUpRight size={16} />
										</button>
									)}
								</section>
								<section className="connection-card panel">
									<h3>{t("访问地址")}</h3>
									<div className="address-box">
										<code>{address}</code>
										<button
											type="button"
											className="icon-button"
											aria-label={t("复制访问地址")}
											onClick={() => {
												void copyAddress(address)
													.then(() => notify(t("访问地址已复制")))
													.catch((error) => notify(error.message));
											}}
										>
											<Copy size={15} />
										</button>
									</div>
									<a
										href={address}
										target="_blank"
										rel="noreferrer"
										className="text-button"
									>
										{t("打开访问地址")}
										<ExternalLink size={13} />
									</a>
								</section>
								<section className="health-card">
									<div>
										<span
											className={`status-dot ${status?.mediaOnline ? "online" : ""}`}
										/>
										MediaMTX{" "}
										<strong>
											{status?.mediaOnline ? t("在线") : t("未连接")}
										</strong>
									</div>
									<div>
										<AudioLines size={14} />
										{t("采集重试")}
										<strong>
											{status?.restarts ?? 0}
											{t("次")}
										</strong>
									</div>
									{status?.next && (
										<p>
											{t("下一次")}
											{status.next.enabled ? t("开始") : t("停止")}：
											{new Date(status.next.at).toLocaleString(locale(), {
												timeZone: status.timezone,
											})}
										</p>
									)}
									{role === "admin" && (
										<button
											type="button"
											className="text-button"
											disabled={busy || !status?.desired}
											onClick={() => control("restart")}
										>
											<RotateCw size={13} />
											{t("重启采集")}
										</button>
									)}
								</section>
							</aside>
							{status?.error && (
								<div className="capture-error">
									<strong>{t("采集需要关注")}</strong>
									<pre>{translateMessage(status.error)}</pre>
									{role === "admin" && (
										<button
											type="button"
											className="text-button"
											onClick={() => setPage("events")}
										>
											{t("查看运行日志")}
											<ArrowUpRight size={14} />
										</button>
									)}
								</div>
							)}
						</div>
					)}
					{page === "settings" && draft && (
						<>
							<Settings config={draft} onChange={setDraft} notify={notify} />
							<ConfigTransfer
								config={saved!.config}
								onImport={setDraft}
								notify={notify}
							/>
						</>
					)}
					{page === "schedules" && draft && (
						<Schedules config={draft} onChange={setDraft} status={status} />
					)}
					{["settings", "schedules"].includes(page) && draft && (
						<SaveBar
							busy={busy}
							dirty={dirty}
							onSave={save}
							onReset={() => setDraft(structuredClone(saved!.config))}
						/>
					)}
					{["settings", "schedules"].includes(page) && !draft && (
						<div className="inline-warning">
							{t("配置尚未加载，请刷新页面重试。")}
						</div>
					)}
					{page === "security" && (
						<Security notify={notify} onLogout={logoutLocal} />
					)}
					{page === "events" && <Events />}
				</main>
			</div>
			{toast}
		</div>
	);
}
