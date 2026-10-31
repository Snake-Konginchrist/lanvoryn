import { ChevronDown, Settings2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeSwitch } from "./ThemeSwitch";

export function Preferences({ compact = false }: { compact?: boolean }) {
	const ref = useRef<HTMLDetailsElement>(null);
	useEffect(() => {
		const outside = (event: PointerEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node))
				ref.current.open = false;
		};
		const escape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && ref.current?.open) {
				ref.current.open = false;
				ref.current.querySelector("summary")?.focus();
			}
		};
		document.addEventListener("pointerdown", outside);
		document.addEventListener("keydown", escape);
		return () => {
			document.removeEventListener("pointerdown", outside);
			document.removeEventListener("keydown", escape);
		};
	}, []);
	return (
		<details ref={ref} className={`preferences ${compact ? "compact" : ""}`}>
			<summary aria-label={t("偏好设置")}>
				<Settings2 size={18} aria-hidden="true" />
				{!compact && (
					<>
						<span>{t("偏好设置")}</span>
						<ChevronDown
							size={14}
							className="preferences-chevron"
							aria-hidden="true"
						/>
					</>
				)}
			</summary>
			<div className="preferences-panel">
				<ThemeSwitch />
				<LanguageSwitch />
			</div>
		</details>
	);
}
