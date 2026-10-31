import type { EventEntry } from "@lanvoryn/shared";
import { Download, ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import { api, downloadBlob, fileStamp } from "../api";
import { locale, t } from "../i18n";

export function Events() {
	const [events, setEvents] = useState<EventEntry[]>([]);
	const [level, setLevel] = useState("all");
	const [error, setError] = useState("");
	useEffect(() => {
		let active = true;
		const load = () =>
			void api<{ events: EventEntry[] }>("/events")
				.then((result) => {
					if (active) {
						setEvents(result.events);
						setError("");
					}
				})
				.catch((cause) => {
					if (active) setError(cause.message);
				});
		load();
		const timer = setInterval(load, 5000);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, []);
	const visible = events.filter(
		(event) => level === "all" || level === event.level,
	);
	return (
		<section className="panel logs-panel">
			<div className="logs-toolbar">
				<div>
					<h2>{t("事件日志")}</h2>
				</div>
				<div className="actions">
					<ListFilter size={17} />
					<select
						aria-label={t("日志级别")}
						value={level}
						onChange={(e) => setLevel(e.target.value)}
					>
						<option value="all">{t("所有级别")}</option>
						<option value="info">{t("正常事件")}</option>
						<option value="warn">{t("警告")}</option>
						<option value="error">{t("错误")}</option>
					</select>
					<button
						type="button"
						className="button ghost"
						onClick={() =>
							downloadBlob(
								new Blob([JSON.stringify(events, null, 2)], {
									type: "application/json",
								}),
								`lanvoryn-events-${fileStamp()}.json`,
							)
						}
					>
						<Download size={15} />
						{t("导出")}
					</button>
				</div>
			</div>
			{error && <p className="inline-warning">{error}</p>}
			<div className="log-list">
				{visible.length ? (
					visible.map((event) => (
						<article className={`log-row ${event.level}`} key={event.id}>
							<time>
								{new Date(event.at).toLocaleString(locale(), { hour12: false })}
							</time>
							<span className="log-level">{event.level.toUpperCase()}</span>
							<pre>{event.message}</pre>
						</article>
					))
				) : (
					<div className="empty-note">{t("当前没有此级别的事件。")}</div>
				)}
			</div>
		</section>
	);
}
