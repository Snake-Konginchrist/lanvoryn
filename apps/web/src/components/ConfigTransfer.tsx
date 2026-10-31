import { type AppConfig, configSchema } from "@lanvoryn/shared";
import { Download, Upload } from "lucide-react";
import { useRef } from "react";
import { downloadBlob, fileStamp } from "../api";
import { t } from "../i18n";

export function ConfigTransfer({
	config,
	onImport,
	notify,
}: {
	config: AppConfig;
	onImport: (config: AppConfig) => void;
	notify: (message: string) => void;
}) {
	const file = useRef<HTMLInputElement>(null);
	return (
		<div className="config-transfer">
			<div>
				<strong>{t("配置随你迁移")}</strong>
				<p>{t("导入导出采集参数与定时计划，不包含密码或登录会话。")}</p>
			</div>
			<div className="actions">
				<button
					type="button"
					className="button ghost"
					onClick={() =>
						downloadBlob(
							new Blob(
								[
									JSON.stringify(
										{ format: "lanvoryn-config/v1", config },
										null,
										2,
									),
								],
								{ type: "application/json" },
							),
							`lanvoryn-config-${fileStamp()}.json`,
						)
					}
				>
					<Download size={15} />
					{t("导出配置")}
				</button>
				<button
					type="button"
					className="button ghost"
					onClick={() => file.current?.click()}
				>
					<Upload size={15} />
					{t("导入配置")}
				</button>
			</div>
			<input
				ref={file}
				type="file"
				accept="application/json,.json"
				hidden
				aria-label={t("选择配置文件")}
				onChange={(event) => {
					const selected = event.target.files?.[0];
					event.target.value = "";
					if (!selected) return;
					if (selected.size > 65536) {
						notify(t("配置文件不能超过 64 KB"));
						return;
					}
					void selected
						.text()
						.then((text) => {
							const value = JSON.parse(text);
							if (value.format !== "lanvoryn-config/v1")
								throw new Error(t("不支持的配置文件格式"));
							onImport(configSchema.parse(value.config));
							notify(t("配置已载入草稿，请检查后点击保存并应用"));
						})
						.catch(() => notify(t("配置文件无效，原有配置未更改")));
				}}
			/>
		</div>
	);
}
