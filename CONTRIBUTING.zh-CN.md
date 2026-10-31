# 贡献指南

[English](CONTRIBUTING.md) · **简体中文**

使用当前稳定 Node.js LTS 和 npm。安装依赖使用 `npm ci`；新增或升级直接依赖使用 `npm install 包名@latest -w 工作区`，卸载使用 `npm uninstall 包名 -w 工作区`，同步提交锁文件。不要手动修改 `node_modules`。

提交前运行 `npm run check`、`npm run lint`、`npm test`、`npm run build`。涉及播放器、权限或媒体管线时运行 `npm run test:e2e`。真实硬件验证应说明系统、摄像头格式、编码器和浏览器，不能用合成源测试冒充硬件成功。

语言资源位于 `apps/web/src/locales`，所有语言的键和插值参数必须一致。前端使用 i18next / react-i18next；密码和会话信息不进入翻译资源或浏览器 localStorage。

保持模块职责清楚：shared 定义参数与时间逻辑；server 处理权限、设备和进程；web 只通过 API/WHEP 与后端通信。不接受客户端传入的任意命令、过滤器表达式或媒体地址。

## 哪些内容应该提交

应提交：应用与共享源码、全部语言资源、刻意制作的界面/文档素材、测试、部署模板、初始化脚本、英文和中文文档、LICENSE、已脱敏的 `.env.example` 模板、团队共用工具配置，以及 `package.json` 和 `package-lock.json`。仓库 `.npmrc` 只设置公共 registry；认证 token 应留在用户自己的私有 npm 配置中。

不提交：已安装依赖、编译输出、缓存、下载的媒体程序、本地 `.env`、账号/会话数据、运行时设置、日志、覆盖率和浏览器报告、录像、备份、自动生成的 TLS 证书和私钥。运行产物放到 `.runtime/` 或配置的数据目录。允许共享编辑器配置，不提交个人 IDE 状态。

所有工作区统一由根 `.gitignore` 管理。忽略规则不能自动移除已暂存文件；误暂存的密钥应使用 `git rm --cached -- 路径` 移出索引，保留本地文件。如果已经进入发布历史，仅删除最新文件还不够，需要撤销密钥并协调清理历史。
