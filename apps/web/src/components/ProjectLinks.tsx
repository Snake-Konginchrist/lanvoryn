import { config } from "@fortawesome/fontawesome-svg-core";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { APP_VERSION } from "@lanvoryn/shared";
import { t } from "../i18n";

// CSS 随构建打包，避免运行时插入样式或依赖外部图标服务。
config.autoAddCss = false;
const repository = "https://github.com/Snake-Konginchrist/lanvoryn";

export function ProjectLinks({ login = false }: { login?: boolean }) {
	return (
		<div className={`project-links ${login ? "login-project-links" : ""}`}>
			<a
				className="repository-link"
				href={repository}
				target="_blank"
				rel="noopener noreferrer"
			>
				<FontAwesomeIcon icon={faGithub} aria-hidden="true" />
				<span>{t("开源仓库")}</span>
			</a>
			<a
				className="version-link"
				href={`${repository}/releases/tag/v${APP_VERSION}`}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={t("版本说明")}
				title={t("版本说明")}
			>
				v{APP_VERSION}
			</a>
		</div>
	);
}
