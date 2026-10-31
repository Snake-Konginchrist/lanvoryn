import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { languages } from "../i18n";

export function LanguageSwitch() {
	const { i18n } = useTranslation();
	return (
		<label className="language-switch">
			<Languages size={15} aria-hidden="true" />
			<select
				aria-label="Language / 语言"
				value={i18n.resolvedLanguage ?? "en"}
				onChange={(event) => {
					void i18n.changeLanguage(event.target.value);
				}}
			>
				{languages.map(([code, name]) => (
					<option key={code} value={code}>
						{name}
					</option>
				))}
			</select>
		</label>
	);
}
