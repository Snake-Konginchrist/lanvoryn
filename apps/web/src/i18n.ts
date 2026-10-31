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
export const locale = () => i18next.resolvedLanguage ?? "en";
i18next.on("languageChanged", (language) => {
	document.documentElement.lang = language;
	document.title = `Lanvoryn · ${t("你的私有现场")}`;
});
document.documentElement.lang = locale();
document.title = `Lanvoryn · ${t("你的私有现场")}`;
export default i18next;
