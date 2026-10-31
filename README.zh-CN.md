# Lanvoryn

[English](README.md) · **简体中文**

**局域网实时音视频。**

**你的网络，你的现场。** 带密码保护、设备参数和定时计划的局域网实时音视频控制台。

Lanvoryn 将 Linux USB 摄像头与麦克风通过 FFmpeg 编码，再由 MediaMTX 以 WebRTC 传送给浏览器。同一局域网内的手机、平板和电脑，输入服务器地址并登录即可观看、收听。

> 当前是真实可运行的项目；本机测试使用显式的合成测试源。真实 Linux 摄像头、1050 显卡持续采集性能和手机浏览器兼容性，需要在目标设备验收。不会在设备故障时自动切换为演示画面。

## 功能

- 实时音视频、仅视频、仅音频三种观看模式；单轨模式通过 WebRTC 协商选择轨道。
- 分辨率、帧率、视频/音频码率、CPU/NVENC、关键帧、旋转、镜像、声道、输入采样率、增益、降噪、高通、音画偏移。
- 设备枚举、分辨率和帧率能力查询、摄像头硬件控制项（亮度、曝光、对焦等，以实际设备支持为准）。
- 管理员与只读访客；scrypt 密码哈希、HttpOnly Cookie、登录限流、写请求来源校验、会话撤销与媒体连接关闭。
- 手动、持续、每周时段三种采集策略；支持跨午夜、时区、重启恢复，以及一键隐私停止。
- 实际接收帧率、码率、RTT、丢包和播放会话状态；自动重连、采集故障退避重试、最近 200 条事件。
- 截图、浏览器本地录制（单次上限 10 分钟）、全屏、画中画、播放音量；取决于浏览器能力。
- 参数和计划导入导出，不包含密码；手机响应式界面。
- **8 种界面语言**：简体中文、繁體中文、English、日本語、한국어、Español、Français、Deutsch。i18next 自动检测并记住语言偏好，语言资源随应用本地提供，无需外部翻译服务。
- systemd 安装、开机启动、服务隔离与部署文档。

## 技术栈

React + TypeScript + Vite，Fastify，Zod，i18next / react-i18next；FFmpeg + MediaMTX + WebRTC/WHEP；npm workspaces；Node.js 24+。应用采用 MIT 许可，上游组件保持各自许可。

初始化使用官方 `npm init -y` 和 `npm create vite@latest apps/web -- --template react-ts --no-interactive`。直接依赖通过官方 `npm install ...@latest` 安装；发布状态和版本依据见 [调研与版本记录](docs/RESEARCH.zh-CN.md)。`package-lock.json` 固定本次验证版本，部署使用 `npm ci`，便于复现。

## 快速开始

先安装 [Node.js 最新稳定 LTS](https://nodejs.org/en/download)、[FFmpeg](https://ffmpeg.org/download.html)。真实采集还需要 Linux、`v4l-utils`、`alsa-utils` 和摄像头/麦克风权限。

```bash
npm ci
npm run setup
# 编辑 .env：真实设备设 linux，本机体验可显式设 demo。
# LANVORYN_MEDIA_HOST 必须填写其他设备可到达的服务器局域网 IP。
npm run media:install
npm run media:config
npm run build
```

分别在两个终端运行：

```bash
npm run media:start
```

```bash
npm start
```

打开 `http://服务器局域网IP:3210`，使用自己设置的管理员密码登录。首次默认停止采集；选择设备、保存参数，再点击“开始采集”。浏览器通常需要点击“开启声音”才能有声播放。

局域网需要放行 **3210/TCP**（网页和经过认证的信令）、**8189/UDP 与 TCP**（WebRTC 媒体）；管理、RTSP、原始 WHEP 均仅绑定回环接口，不应对局域网开放。

## 文档

- [Linux / Ubuntu 与 systemd 部署](docs/DEPLOYMENT.zh-CN.md)
- [架构、权限边界与定时语义](docs/ARCHITECTURE.zh-CN.md)
- [参数和常见故障](docs/CONFIGURATION.zh-CN.md)
- [官方来源、初始化命令与版本](docs/RESEARCH.zh-CN.md)
- [验证范围与验收清单](docs/VERIFICATION.zh-CN.md)
- [贡献指南](CONTRIBUTING.zh-CN.md)、[安全报告](SECURITY.zh-CN.md)

## 开发和检查

```bash
npm run dev       # Vite 127.0.0.1:5173，代理 API 到 3210
npm run check     # 类型检查
npm run lint      # Biome 检查
npm test          # 认证、参数、设备解析与定时逻辑
npm run build
npm run media:install
npx playwright install chromium
npm run test:e2e  # 真实合成 A/V → MediaMTX → Chromium；独立测试账号和目录
```
