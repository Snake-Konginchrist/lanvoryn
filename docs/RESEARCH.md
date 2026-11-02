# Sources and dependency policy

**English** · [简体中文](RESEARCH.zh-CN.md)

Research and initial dependency resolution: **2026-10-31**. Latest npm dependency refresh: **2026-11-02**. Recommendations are based on the following primary sources:

| Decision                                          | Official source                                                                                            |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Official React/TypeScript scaffold                | [Vite getting started](https://vite.dev/guide/)                                                            |
| Backend installation and API model                | [Fastify getting started](https://fastify.dev/docs/latest/Guides/Getting-Started/)                         |
| Linux webcam capture through FFmpeg               | [MediaMTX generic webcams](https://mediamtx.org/docs/publish/generic-webcams)                              |
| RTSP publishing from FFmpeg                       | [MediaMTX FFmpeg publishing](https://mediamtx.org/docs/publish/ffmpeg)                                     |
| Browser WebRTC playback and higher HLS latency    | [MediaMTX browser playback](https://mediamtx.org/docs/read/web-browsers)                                   |
| H.264 without B-frames, Opus and ICE connectivity | [MediaMTX WebRTC features](https://mediamtx.org/docs/features/webrtc-specific-features)                    |
| Listener and authentication configuration         | [MediaMTX configuration reference](https://mediamtx.org/docs/references/configuration-file)                |
| ALSA capture                                      | [FFmpeg official input-device documentation](https://github.com/FFmpeg/FFmpeg/blob/master/doc/indevs.texi) |
| Mainstream localization integration               | [react-i18next getting started](https://react.i18next.com/getting-started)                                 |

Alternatives considered: [go2rtc's device module](https://github.com/AlexxIT/go2rtc/tree/master/internal/ffmpeg/device) documents video-only support for its Linux device shorthand; [exec sources](https://github.com/AlexxIT/go2rtc/tree/master/internal/exec) can still ingest a custom FFmpeg audio/video process. [uStreamer + Janus](https://github.com/pikvm/ustreamer/blob/master/docs/h264.md) is another viable integration, but its documented setup requires additional components and its audio example is capture-device-specific. These facts support choosing an explicit FFmpeg + MediaMTX pipeline; they do not establish that alternatives are incapable of audio.

## Official commands

```bash
npm init -y
npm create vite@latest apps/web -- --template react-ts --no-interactive
npm init -y -w apps/server
npm init -y -w packages/shared
npm install PACKAGE@latest -w WORKSPACE
npm uninstall PACKAGE -w WORKSPACE
```

The project `.npmrc` selects the official npm registry. Initial direct packages were resolved against stable latest tags, then recorded in `package-lock.json`. `npm ci` intentionally reproduces that tested snapshot rather than silently upgrading on every deployment. The MediaMTX installer downloads official stable release assets and verifies official SHA-256 checksums; the locally validated release was **v1.21.3**.

`@fastify/static` currently requests an older glob major. The root override selects patched **glob 14.0.3** (with minimatch 11) instead of downgrading Fastify's static plugin. Static serving and authenticated APIs were exercised after this change. Reassess the override when upstream updates its dependency range.

The dependency snapshot below is generated from installed workspace manifests. Original operating-system tools and NVIDIA drivers are installed through their own supported distribution/vendor channels, not npm. Installation documentation recommends a supported stable Node.js LTS rather than a prerelease; no particular developer machine or personal runtime layout is required.

| Package          | Installed |
| ---------------- | --------- |
| fastify          | 5.12.7    |
| zod              | 4.6.7     |
| i18next          | 26.7.1    |
| react-i18next    | 17.1.11   |
| react            | 19.3.1    |
| typescript       | 7.0.2     |
| vite             | 8.3.5     |
| @playwright/test | 1.64.1    |
