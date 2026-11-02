import { Settings2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "../../i18n";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeSwitch } from "./ThemeSwitch";

export function Preferences({ compact = false }: { compact?: boolean }) {
	const [open, setOpen] = useState(false);
	const dialog = useRef<HTMLDialogElement>(null);
	const id = useId();
	useEffect(() => {
		if (!open || !dialog.current) return;
		const element = dialog.current;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		element.showModal();
		return () => {
			element.close();
			document.body.style.overflow = previous;
		};
	}, [open]);
	return (
		<>
			<button
				type="button"
				className={`preferences-trigger ${compact ? "compact" : ""}`}
				aria-label={t("偏好设置")}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={id}
				onClick={() => setOpen(true)}
			>
				<Settings2 size={18} aria-hidden="true" />
				{!compact && <span>{t("偏好设置")}</span>}
			</button>
			{createPortal(
				<dialog
					ref={dialog}
					id={id}
					className="preferences-dialog"
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							event.preventDefault();
							setOpen(false);
						}
					}}
					aria-labelledby={`${id}-title`}
					onCancel={(event) => {
						event.preventDefault();
						setOpen(false);
					}}
					onClose={() => setOpen(false)}
					onClick={(event) => {
						if (event.target !== event.currentTarget) return;
						const rect = event.currentTarget.getBoundingClientRect();
						if (
							event.clientX < rect.left ||
							event.clientX > rect.right ||
							event.clientY < rect.top ||
							event.clientY > rect.bottom
						)
							setOpen(false);
					}}
				>
					<div className="preferences-header">
						<h2 id={`${id}-title`}>{t("偏好设置")}</h2>
						<button
							type="button"
							className="icon-button"
							aria-label={t("关闭偏好设置")}
							onClick={() => setOpen(false)}
						>
							<X size={20} />
						</button>
					</div>
					<div className="preferences-panel">
						<div className="preference-row">
							<span>{t("界面主题")}</span>
							<ThemeSwitch />
						</div>
						<div className="preference-row">
							<span>{t("语言")}</span>
							<LanguageSwitch />
						</div>
					</div>
				</dialog>,
				document.body,
			)}
		</>
	);
}
