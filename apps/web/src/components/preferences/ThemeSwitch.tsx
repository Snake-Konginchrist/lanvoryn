import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

type ThemePreference = "system" | "light" | "dark";
declare global {
	interface Window {
		lanvorynTheme: {
			get: () => ThemePreference;
			set: (value: ThemePreference) => void;
			subscribe: (listener: () => void) => () => void;
		};
	}
}

export function ThemeSwitch() {
	const { t } = useTranslation();
	const theme = useSyncExternalStore(
		window.lanvorynTheme.subscribe,
		window.lanvorynTheme.get,
	);
	const Icon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;
	return (
		<label className="theme-switch">
			<Icon size={15} aria-hidden="true" />
			<select
				aria-label={t("界面主题")}
				value={theme}
				onChange={(event) =>
					window.lanvorynTheme.set(event.target.value as ThemePreference)
				}
			>
				<option value="system">{t("跟随系统")}</option>
				<option value="light">{t("浅色")}</option>
				<option value="dark">{t("深色")}</option>
			</select>
		</label>
	);
}
