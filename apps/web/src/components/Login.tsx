import type { Role } from "@lanvoryn/shared";
import { ArrowUpRight, AudioLines, LockKeyhole, Radio } from "lucide-react";
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
					<span>Lanvoryn</span>
				</a>
				<div className="story-copy">
					<h1>{t("音视频")}</h1>
				</div>
				<div className="signal-art" aria-hidden="true">
					<div className="signal-orbit" />
					<AudioLines size={90} strokeWidth={1} />
				</div>
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
					<h2>{t("登录")}</h2>
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
				</form>
				<span className="login-version">Lanvoryn / v0.1.0</span>
			</div>
		</main>
	);
}
