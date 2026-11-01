# Lanvoryn

自行部署的局域网实时摄像头与麦克风串流应用。

将摄像头和麦克风连接到 Linux 主机，即可在同一局域网的手机、平板或电脑上，通过浏览器观看、收听。支持仅视频、仅音频和音视频播放，使用密码控制访问，无需云账号。

![Lanvoryn 实时监看页面，包含视频、播放控制和传输状态](docs/images/live-view.zh-CN.png)

*截图来自本地演示，使用程序生成的画面和声音；主机名与地址均为示例。*

## 功能

- **实时音视频：** 通过 WebRTC 在浏览器播放，支持仅视频、仅音频和音视频三种模式。
- **空闲时释放设备：** 按播放需求启动采集，最后一个观看者离开后停止；只打开当前观看者需要的输入，仅视频播放不会请求麦克风。
- **设备与画质控制：** 分别选择摄像头和麦克风，调整设备支持的分辨率、帧率、编码、码率、音频增益、滤镜和音画同步。
- **访问保护：** 管理员与只读访客权限、可撤销的会话，以及释放设备并断开观看者的隐私停止。
- **观看计划：** 手动、持续或每周定时开放，支持跨午夜时段与时区；无人播放时仍释放设备。
- **播放与管理工具：** 截图、浏览器本地录制、传输统计和自动重连，以及配置导入导出和事件日志。

## 快速开始

采集主机需要 **Linux、Node.js 24+、npm、FFmpeg、`v4l-utils` 和 `alsa-utils`**，并具备访问所选设备的权限。观看设备只需兼容的浏览器。需要开机启动时，参阅 [systemd 部署指南](docs/DEPLOYMENT.zh-CN.md)。

```bash
git clone https://github.com/Snake-Konginchrist/lanvoryn.git
cd lanvoryn
npm ci
npm run setup
```

初始化会创建网页管理员账号；若 `.env` 不存在，还会从 `.env.example` 复制生成。在终端设置账号和 12–128 个字符的密码，没有默认密码。

编辑 `.env`，将媒体地址设为观看设备能访问的 Linux 主机局域网 IP。例如：

```dotenv
LANVORYN_SOURCE=linux
LANVORYN_MEDIA_HOST=192.168.1.50
```

没有采集硬件、只需本地体验时，显式设置 `LANVORYN_SOURCE=demo`，使用测试画面与 440 Hz 测试音；设备故障不会自动切换为演示源。

```bash
npm run media:install
npm run media:config
npm run build
```

在一个终端启动 MediaMTX：

```bash
npm run media:start
```

在另一个终端进入同一项目目录，启动应用：

```bash
npm start
```

将示例 IP 换为主机实际的局域网 IP，打开 `http://192.168.1.50:3210`。登录后，在“采集参数”中选择设备并保存，返回“实时监看”，点击“开始采集”。此操作开放观看，只有播放器需要时才占用设备。浏览器要求时，点击“开启声音”收听音频。

局域网需放行 **3210/TCP**（网页）和 **8189/UDP 与 TCP**（WebRTC 媒体）。内部媒体与管理端口保持私有；共享或不可信网络应使用 HTTPS，因为 HTTP 不加密登录数据。

## 文档

- [Linux 与 systemd 部署](docs/DEPLOYMENT.zh-CN.md)
- [参数与常见故障](docs/CONFIGURATION.zh-CN.md)
- [架构与访问边界](docs/ARCHITECTURE.zh-CN.md)
- [技术选型与依赖策略](docs/RESEARCH.zh-CN.md)
- [验证范围](docs/VERIFICATION.zh-CN.md)

## 开发与贡献

界面使用 React、TypeScript 和 Vite，应用与 API 由 Fastify 提供。FFmpeg 编码 H.264/Opus，MediaMTX 通过 WebRTC/WHEP 传送媒体。仓库采用 npm workspaces，经验证的依赖版本记录在 `package-lock.json` 中。

```bash
npm run dev
npm run check
npm run lint
npm test
npm run build
```

贡献约定与浏览器测试准备见 [贡献指南](CONTRIBUTING.zh-CN.md)，安全问题请按照 [安全政策](SECURITY.zh-CN.md) 报告。

## 许可证

[MIT](LICENSE)。上游软件遵循各自的许可证。

---

文档语言：[English](README.md) | **简体中文**
