import type { SessionInfo } from "@lanvoryn/shared";
import { KeyRound, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { locale, t } from "../i18n";
import { Field, Section, Toggle } from "./ui";

interface SecurityData {
	viewerEnabled: boolean;
	username: string;
	sessions: SessionInfo[];
	secureCookie: boolean;
	sessionHours: number;
}
export function Security({
	notify,
	onLogout,
}: {
	notify: (message: string) => void;
	onLogout: () => void;
}) {
	const [data, setData] = useState<SecurityData | null>(null);
	const [enabled, setEnabled] = useState(false);
	const [viewerPassword, setViewerPassword] = useState("");
	const [current, setCurrent] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [busy, setBusy] = useState(false);
	const [refreshKey, refresh] = useState(0);
	const [error, setError] = useState("");
	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey 是用户主动刷新的失效标记。
	useEffect(() => {
		let active = true;
		void api<SecurityData>("/security")
			.then((result) => {
				if (active) {
					setData(result);
					setEnabled(result.viewerEnabled);
					setError("");
				}
			})
			.catch((cause) => {
				if (active) setError(cause.message);
			});
		return () => {
			active = false;
		};
	}, [refreshKey]);
	const action = async (task: () => Promise<unknown>, message: string) => {
		setBusy(true);
		try {
			await task();
			notify(message);
			refresh((value) => value + 1);
		} catch (cause) {
			notify(cause instanceof Error ? cause.message : t("操作失败"));
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="settings-content">
			{error && <p className="inline-warning">{error}</p>}
			<div className="security-banner">
				<ShieldCheck size={26} />
				<div>
					<strong>{t("访问权限在服务器验证")}</strong>
					<p>
						{t(
							"网页接口和 WebRTC 信令均需登录；修改密码或撤销会话，也会断开对应的媒体播放。",
						)}
					</p>
				</div>
			</div>
			<Section
				eyebrow="READ-ONLY ACCESS"
				title={t("只读访客账号")}
				description={t(
					"访客可以观看和收听，无法修改采集参数、计划或管理员设置。账号固定为 viewer，使用独立密码。",
				)}
			>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void action(
							() =>
								api("/security/viewer", {
									method: "PUT",
									body: enabled
										? { enabled: true, password: viewerPassword }
										: { enabled: false },
								}).then(() => setViewerPassword("")),
							enabled
								? t("访客密码已更新，原有访客会话已结束")
								: t("访客访问已关闭"),
						);
					}}
				>
					<Toggle
						label={t("允许访客登录")}
						checked={enabled}
						onChange={setEnabled}
						hint={
							data?.viewerEnabled
								? t("当前已开放访客访问")
								: t("当前只有管理员可以访问")
						}
					/>
					{enabled && (
						<Field
							label={t("设置新的访客密码")}
							hint={t("至少 12 个字符。访客密码与管理员密码独立保存。")}
						>
							<input
								type="password"
								autoComplete="new-password"
								minLength={12}
								maxLength={128}
								required
								value={viewerPassword}
								onChange={(e) => setViewerPassword(e.target.value)}
							/>
						</Field>
					)}
					<button
						type="submit"
						className="button primary"
						disabled={busy || !data}
					>
						<Users size={16} />
						{enabled ? t("设置访客密码并开放") : t("保存：关闭访客访问")}
					</button>
				</form>
			</Section>
			<Section
				eyebrow="ADMINISTRATOR"
				title={t("修改管理员密码")}
				description={t(
					"管理员账号：{{p0}}。修改后，所有管理员设备需要重新登录。",
					{ p0: data?.username ?? "…" },
				)}
			>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						if (password !== confirm) {
							notify(t("两次输入的新密码不一致"));
							return;
						}
						void action(
							() =>
								api("/security/password", {
									method: "PUT",
									body: { current, password },
								}).then(onLogout),
							t("密码已修改，请重新登录"),
						);
					}}
				>
					<div className="form-grid">
						<Field label={t("当前密码")}>
							<input
								type="password"
								autoComplete="current-password"
								required
								maxLength={128}
								value={current}
								onChange={(e) => setCurrent(e.target.value)}
							/>
						</Field>
						<div />
						<Field label={t("新密码")}>
							<input
								type="password"
								autoComplete="new-password"
								minLength={12}
								maxLength={128}
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</Field>
						<Field label={t("确认新密码")}>
							<input
								type="password"
								autoComplete="new-password"
								minLength={12}
								maxLength={128}
								required
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
							/>
						</Field>
					</div>
					<button
						type="submit"
						className="button ghost"
						disabled={busy || !data}
					>
						<KeyRound size={16} />
						{t("更新管理员密码")}
					</button>
				</form>
			</Section>
			<Section
				eyebrow="ACTIVE SESSIONS"
				title={t("已登录设备")}
				description={t(
					"会话有效期 {{p0}} 小时。结束会话将同时结束该设备的媒体连接。",
					{ p0: data?.sessionHours ?? "…" },
				)}
			>
				<button
					type="button"
					className="button ghost"
					onClick={() => refresh((value) => value + 1)}
					disabled={busy}
				>
					<RefreshCw size={15} />
					{t("刷新设备列表")}
				</button>
				<div className="session-list">
					{data?.sessions.map((session) => (
						<div className="session-row" key={session.id}>
							<div className="session-avatar">
								<Users size={18} />
							</div>
							<div>
								<strong>
									{session.role === "admin" ? t("管理员") : t("只读访客")}{" "}
									{session.current && (
										<span className="badge">{t("当前设备")}</span>
									)}
								</strong>
								<span className="mono">{session.ip}</span>
								<small>
									{new Date(session.createdAt).toLocaleString(locale())}
									{t("登录")}
								</small>
							</div>
							<button
								type="button"
								className="button ghost danger"
								disabled={busy}
								onClick={() => {
									void action(
										() =>
											api(`/security/sessions/${session.id}`, {
												method: "DELETE",
											}).then(() => {
												if (session.current) onLogout();
											}),
										t("该设备会话已结束"),
									);
								}}
							>
								{t("结束会话")}
							</button>
						</div>
					))}
				</div>
			</Section>
			<div className="schedule-note">
				<ShieldCheck size={19} />
				<p>
					{data?.secureCookie
						? t("已启用 Secure Cookie，请通过 HTTPS 访问。")
						: t(
								"当前适用于可信局域网 HTTP 访问。密码登录保护访问权限，HTTP 本身不加密登录信息；公共或不可信网络应按部署文档启用 HTTPS。",
							)}
					{t("IP 白名单和域名由服务器环境变量配置。")}
				</p>
			</div>
		</div>
	);
}
