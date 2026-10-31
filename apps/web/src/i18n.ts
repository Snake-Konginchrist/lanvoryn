import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import zh from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";

export const languages = [
	["zh-CN", "简体中文"],
	["zh-TW", "繁體中文"],
	["en", "English"],
	["ja", "日本語"],
	["ko", "한국어"],
	["es", "Español"],
	["fr", "Français"],
	["de", "Deutsch"],
] as const;

void i18next
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources: {
			"zh-CN": { translation: zh },
			"zh-TW": { translation: zhTW },
			en: { translation: en },
			ja: { translation: ja },
			ko: { translation: ko },
			es: { translation: es },
			fr: { translation: fr },
			de: { translation: de },
		},
		supportedLngs: languages.map(([code]) => code),
		fallbackLng: "en",
		load: "currentOnly",
		keySeparator: false,
		nsSeparator: false,
		interpolation: { escapeValue: false },
		detection: {
			order: ["localStorage", "navigator"],
			caches: ["localStorage"],
			lookupLocalStorage: "lanvoryn.language",
			convertDetectedLanguage: (code) =>
				/^zh-(TW|HK|MO|Hant)/i.test(code)
					? "zh-TW"
					: code.startsWith("zh")
						? "zh-CN"
						: code.split("-")[0]!,
		},
	});

export const t = (key: string, values?: Record<string, unknown>) =>
	String(i18next.t(key, values));
// 兼容已保存的旧事件；设备型号和第三方诊断原文不作为翻译键改写。
export function translateMessage(
	message: string,
	values?: Record<string, string | number>,
): string {
	if (values) return t(message, values);
	const patterns: [RegExp, string, string[]][] = [
		[/^登录失败 · (.+)$/, "登录失败 · {{ip}}", ["ip"]],
		[/^管理员登录 · (.+)$/, "管理员登录 · {{ip}}", ["ip"]],
		[/^访客登录 · (.+)$/, "访客登录 · {{ip}}", ["ip"]],
		[
			/^摄像头控制项 (.+) 已更新为 (.+)$/,
			"摄像头控制项 {{name}} 已更新为 {{value}}",
			["name", "value"],
		],
	];
	const legacy: Record<string, string> = {
		管理员执行开始采集: "管理员开始采集",
		管理员执行隐私停止: "管理员停止采集",
		管理员执行重启采集: "管理员重启采集",
		"访客访问已启用 / 更新密码": "访客访问已启用或密码已更新",
	};
	return message
		.split("\n")
		.map((line) => {
			for (const [pattern, key, names] of patterns) {
				const match = line.match(pattern);
				if (match)
					return t(
						key,
						Object.fromEntries(
							names.map((name, index) => [name, match[index + 1]]),
						),
					);
			}
			return t(legacy[line] ?? line);
		})
		.join("\n");
}
export const locale = () => i18next.resolvedLanguage ?? "en";
i18next.on("languageChanged", (language) => {
	document.documentElement.lang = language;
	document.title = `Lanvoryn · ${t("你的私有现场")}`;
});
document.documentElement.lang = locale();
document.title = `Lanvoryn · ${t("你的私有现场")}`;
export default i18next;
