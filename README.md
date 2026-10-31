# Lanvoryn

**Real-time audio & video on your LAN.**

**English** · [简体中文](README.zh-CN.md)

**Your network. Your live space.** A self-hosted, password-protected LAN audio/video console for Linux USB cameras and microphones.

Lanvoryn captures video and audio with FFmpeg, routes H.264 + Opus through MediaMTX, and plays them in a browser using WebRTC. Other computers, phones and tablets on your LAN can open the server address and sign in. No cloud account is required.

## Features

- Real-time LAN audio/video streaming, with audio-only and video-only playback modes.
- Select a camera and microphone independently from multiple connected devices; inspect supported capture modes and hardware controls.
- Adjust resolution, frame rate, encoding, video/audio bitrate, channels, capture gain, noise reduction and A/V synchronization offset.
- Password-protected access, separate administrator and read-only guest accounts, and revocable viewing sessions.
- Manual, continuous or scheduled capture, including overnight windows, time zones and privacy stop.
- Stream statistics, automatic playback reconnection and capture failure recovery.
- Snapshots and browser-local recording.
- Configuration import/export, event logs and systemd service management.

## Stack

React, TypeScript, Vite, Fastify, Zod, i18next, FFmpeg, MediaMTX and WebRTC/WHEP; npm workspaces; Node.js 24+. Application source is MIT licensed; upstream software retains its own licenses.

The project was initialized with the official `npm init -y` and `npm create vite@latest apps/web -- --template react-ts --no-interactive` commands. Direct dependencies were installed with official npm commands and current stable `@latest` tags. The lockfile records the tested versions; deployments use `npm ci`. See [research and versions](docs/RESEARCH.md).

## Quick start

Install a current stable [Node.js LTS](https://nodejs.org/en/download) and [FFmpeg](https://ffmpeg.org/download.html). Real capture requires Linux, `v4l-utils`, `alsa-utils`, and camera/microphone permissions.

```bash
npm ci
npm run setup
```

Edit `.env`. Use `LANVORYN_SOURCE=linux` for real devices, or explicitly choose `demo` for generated test video and a 440 Hz test tone. Set `LANVORYN_MEDIA_HOST` to the server's LAN IP, reachable by viewing devices.

```bash
npm run media:install
npm run media:config
npm run build
```

Run these in separate terminals:

```bash
npm run media:start
```

```bash
npm start
```

Open `http://SERVER_LAN_IP:3210`, sign in with your own administrator password, choose devices, save settings, and start capture. Capture is off by default. Click **Enable sound** if the browser requires a user gesture.

Allow **3210/TCP** for the application and authenticated signaling, plus **8189/UDP and TCP** for media. RTSP, raw WHEP and management ports remain loopback-only. HTTP password login does not encrypt login data; use HTTPS on shared or untrusted networks.

## Documentation

- [Linux / Ubuntu and systemd deployment](docs/DEPLOYMENT.md)
- [Architecture and security boundaries](docs/ARCHITECTURE.md)
- [Configuration and troubleshooting](docs/CONFIGURATION.md)
- [Official sources and installed versions](docs/RESEARCH.md)
- [Verification scope](docs/VERIFICATION.md)
- [Contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md)

## Development

```bash
npm run dev       # Vite at 127.0.0.1:5173, API at 3210
npm run check
npm run lint
npm test
npm run build
npm run media:install
npx playwright install chromium
npm run test:e2e
```

End-to-end tests use actual FFmpeg → MediaMTX → Chromium media transmission with synthetic inputs, an isolated data directory, random test credentials and a loopback-only web server. They do not establish real-camera performance, production deployment or phone compatibility. Device failures are reported; the application never silently substitutes demo media.
