# 官方来源与依赖策略

[English](RESEARCH.md) · **简体中文**

调研和首次依赖解析日期：**2026-10-31**。依据为官方文档与实际运行结果：

- [Vite 官方初始化](https://vite.dev/guide/)、[Fastify 官方入门](https://fastify.dev/docs/latest/Guides/Getting-Started/)。
- [MediaMTX Linux 摄像头接入](https://mediamtx.org/docs/publish/generic-webcams)、[FFmpeg 发布](https://mediamtx.org/docs/publish/ffmpeg)、[浏览器播放](https://mediamtx.org/docs/read/web-browsers)。
- [WebRTC 编码和网络要求](https://mediamtx.org/docs/features/webrtc-specific-features)、[监听与认证配置](https://mediamtx.org/docs/references/configuration-file)。
- [FFmpeg 官方 ALSA 输入文档](https://github.com/FFmpeg/FFmpeg/blob/master/doc/indevs.texi)、[react-i18next 官方安装](https://react.i18next.com/getting-started)。

比较过 go2rtc 和 uStreamer + Janus。go2rtc 的 Linux 设备简写只覆盖视频，但可通过 exec + FFmpeg 接入音视频；uStreamer 也有 Janus 音频方案，不能笼统说整个项目没有音频。当前选择显式 FFmpeg + MediaMTX，是针对单台 Linux USB 摄像头/麦克风与浏览器观看的维护性判断，不是排除其他方案的能力。

初始化使用官方 `npm init -y`、`npm create vite@latest`；依赖通过 `npm install 包名@latest -w 工作区` 安装，卸载通过 `npm uninstall`。项目 `.npmrc` 指向 npm 官方 registry，锁文件记录解析快照；部署的 `npm ci` 用于复现，不会在每次开机偷偷升级。

MediaMTX 通过官方稳定 Release 下载并校验 SHA-256，本机验证为 **v1.21.3**。系统 FFmpeg 使用发行版或上游支持的安装渠道，驱动使用 NVIDIA 支持渠道。部署建议受支持的稳定 Node.js LTS，避免 alpha/beta；不依赖开发者个人机器或运行时布局。

`@fastify/static` 当前依赖较旧 glob 主版本，根配置通过 npm override 选择已修复的 **glob 14.0.3**（minimatch 11），未降级静态插件。已在该依赖组合下完成静态页面与认证 API 测试；上游依赖更新后应重新评估此 override。

实际安装的主要版本如下，由工作区清单生成：

| Package          | Installed |
| ---------------- | --------- |
| fastify          | 5.12.7    |
| zod              | 4.6.7     |
| i18next          | 26.5.12   |
| react-i18next    | 17.1.9    |
| react            | 19.3.1    |
| typescript       | 7.0.2     |
| vite             | 8.3.5     |
| @playwright/test | 1.64.1    |
