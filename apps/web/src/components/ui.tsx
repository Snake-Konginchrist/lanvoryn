import { LoaderCircle } from "lucide-react";
import type {
	InputHTMLAttributes,
	ReactNode,
	SelectHTMLAttributes,
} from "react";
import { t } from "../i18n";

export function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: ReactNode;
}) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: children 为嵌套的原生 input/select，浏览器原生关联标签。
		<label className="field">
			<span>{label}</span>
			{children}
			{hint && <small>{hint}</small>}
		</label>
	);
}
export function NumberField({
	label,
	hint,
	...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
	return (
		<Field label={label} hint={hint}>
			<input type="number" {...props} />
		</Field>
	);
}
export function SelectField({
	label,
	hint,
	children,
	...props
}: { label: string; hint?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<Field label={label} hint={hint}>
			<select {...props}>{children}</select>
		</Field>
	);
}
export function Toggle({
	label,
	checked,
	onChange,
	hint,
	disabled,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	hint?: string;
	disabled?: boolean;
}) {
	return (
		<label className="toggle-row">
			<span>
				{label}
				{hint && <small>{hint}</small>}
			</span>
			<input
				type="checkbox"
				role="switch"
				aria-checked={checked}
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				disabled={disabled}
			/>
		</label>
	);
}
export function SaveBar({
	busy,
	dirty,
	onSave,
	onReset,
}: {
	busy: boolean;
	dirty: boolean;
	onSave: () => void;
	onReset: () => void;
}) {
	return (
		<div className="save-bar">
			<span>
				{dirty ? t("有尚未保存的更改") : t("所有更改已保存")}
				<small>{t("采集参数变更会重新连接播放")}</small>
			</span>
			<div className="actions">
				<button
					type="button"
					className="button ghost"
					disabled={!dirty || busy}
					onClick={onReset}
				>
					{t("放弃更改")}
				</button>
				<button
					type="button"
					className="button primary"
					disabled={!dirty || busy}
					onClick={onSave}
				>
					{busy && <LoaderCircle className="spin" size={16} />}
					{t("保存并应用")}
				</button>
			</div>
		</div>
	);
}
export function Section({
	eyebrow,
	title,
	description,
	children,
}: {
	eyebrow: string;
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="panel">
			<div className="section-heading">
				<span className="eyebrow">{eyebrow}</span>
				<h2>{title}</h2>
				{description && <p>{description}</p>}
			</div>
			{children}
		</section>
	);
}
