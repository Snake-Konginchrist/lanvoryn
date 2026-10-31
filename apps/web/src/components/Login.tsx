import type { Role } from "@lanvoryn/shared";
import {
	ArrowUpRight,
	AudioLines,
	LockKeyhole,
	Radio,
	ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { t } from "../i18n";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeSwitch } from "./ThemeSwitch";

export function Login({ onLogin }: { onLogin: (role: Role) => void }) {
	const [username, setUsername] = useState("admin");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	return (
		<main className="login-shell">
			<div className="login-story">
				<a className="brand" href="/" aria-label={t("Lanvoryn 首页")}>
					<Radio size={30} />
					<span>
						Lanvoryn<i>REAL-TIME LAN AUDIO / VIDEO</i>
					</span>
				</a>
				<div className="story-copy">
					<span className="eyebrow">YOUR SPACE. YOUR SIGNAL.</span>
					<h1>
						{t("在场，")}
						<br />
						{t("不必在现场")}
						<span>。</span>
					</h1>
					<p>
						{t("把画面与声音留在你的网络。")}
						<br />
						{t("打开浏览器，与此刻连接。")}
					</p>
				</div>
				<div className="signal-art" aria-hidden="true">
					<div className="signal-orbit" />
					<AudioLines size={90} strokeWidth={1} />
					<span>PRIVATE BY DESIGN</span>
				</div>
				<footer>
					<ShieldCheck size={16} />
					{t("私有连接 · 自主掌控 · 开源构建")}
				</footer>
			</div>
			<div className="login-side">
				<div className="appearance-controls">
					<ThemeSwitch />
					<LanguageSwitch />
				</div>
				<form
					className="login-card"
					onSubmit={(event) => {
						event.preventDefault();
						setBusy(true);
						setError("");
						void api<{ role: Role }>("/auth/login", {
							method: "POST",
							body: { username, password },
						})
							.then((result) => {
								setPassword("");
								onLogin(result.role);
							})
							.catch((cause) => setError(cause.message))
							.finally(() => setBusy(false));
					}}
				>
					<div className="login-icon">
						<LockKeyhole size={23} />
					</div>
					<span className="eyebrow">WELCOME TO YOUR SPACE</span>
					<h2>{t("连接你的现场")}</h2>
					<p>{t("使用管理员或只读访客账号登录。")}</p>
					<label className="field">
						<span>{t("账号")}</span>
						<input
							name="username"
							autoComplete="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							required
							maxLength={64}
						/>
					</label>
					<label className="field">
						<span>{t("密码")}</span>
						<input
							name="password"
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							maxLength={128}
						/>
					</label>
					{error && (
						<p className="form-error" role="alert">
							{error}
						</p>
					)}
					<button
						type="submit"
						className="button primary login-submit"
						disabled={busy}
					>
						{busy ? t("正在验证…") : t("进入控制台")}
						<ArrowUpRight size={18} />
					</button>
					<div className="login-note">
						<ShieldCheck size={16} />
						<span>
							{t("没有默认密码。首次使用请在服务器运行")}
							<code>npm run setup</code>。
						</span>
					</div>
				</form>
				<span className="login-version">Lanvoryn / OPEN SOURCE / v0.1.0</span>
			</div>
		</main>
	);
}
