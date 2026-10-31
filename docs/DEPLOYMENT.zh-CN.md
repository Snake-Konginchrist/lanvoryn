# Linux / Ubuntu 部署

[English](DEPLOYMENT.md) · **简体中文**

推荐直接部署到有摄像头和麦克风的 Linux 主机，使用 systemd 管理应用和 MediaMTX。无需 Docker，无需数据库或云账号。macOS 可用 `demo` 源开发，真实采集管线使用 Linux V4L2 + ALSA。

## 1. 准备运行时和设备

直接使用现有 Node.js 24+，包括安装在用户家目录中的 nvm 版本，不要求移动或重新安装到任何指定目录。只有未安装或版本不足时，才需要按自己选择的受支持方式安装稳定 LTS，参考 [Node.js 官方下载页](https://nodejs.org/en/download)。

```bash
node --version
npm --version
sudo apt update
sudo apt install ffmpeg v4l-utils alsa-utils rsync ca-certificates curl
v4l2-ctl --list-devices
arecord -l
ls -l /dev/v4l/by-id/
```

系统工具使用发行版官方 apt 仓库的受支持版本；JavaScript 依赖使用 npm 官方 registry。`apt` 的 FFmpeg 不保证是上游当天最新版本，如需新版按 [FFmpeg 官方下载说明](https://ffmpeg.org/download.html)安装。不要为追版本随意引入不明 PPA。

确认摄像头能力：

```bash
v4l2-ctl -d /dev/video0 --list-formats-ext
ffmpeg -hide_banner -encoders
nvidia-smi
```

优先使用 `/dev/v4l/by-id/...-video-index0`，音频优先使用 `plughw:Camera,0` 这样的卡标识，避免重启后的数字索引变化。实际名称以 `arecord -l` 为准。

## 2. 安装和构建项目

在独立源码文件夹中执行，不要把所有项目共用的父文件夹初始化为仓库：

```bash
cd /你的路径/lanvoryn
npm ci
cp .env.example .env
```

编辑 `.env`，最少设置：

```dotenv
LANVORYN_HOST=0.0.0.0
LANVORYN_PORT=3210
LANVORYN_SOURCE=linux
LANVORYN_MEDIA_HOST=192.168.1.50
```

将 IP 替换成服务器真实的局域网 IP，建议路由器 DHCP 保留。修改 IP 后需重新生成媒体配置并重启媒体服务。

```bash
npm run media:install
npm run media:config
npm run build
```

MediaMTX 安装器查询上游 GitHub 最新稳定 Release，下载与系统/架构匹配的官方包，核对官方 `checksums.sha256`，校验不通过就停止。安装不包含 FFmpeg 或显卡驱动。可用 `LANVORYN_MEDIAMTX_VERSION=v版本 npm run media:install` 固定经验证的版本。

## 3. 切换现有 uStreamer

不要让 uStreamer 和新采集进程争用同一个摄像头。准备切换时运行：

```bash
sudo systemctl stop ustreamer.service
```

先保留原服务配置。在新方案通过真机验收后，再决定是否执行 `sudo systemctl disable ustreamer.service`。

## 4. 安装 systemd 服务

```bash
bash scripts/install-systemd.sh
```

请从已加载所需 Node/npm 的用户终端运行安装器。脚本在申请 sudo 之前解析当前选中的 Node 路径，并默认使用该用户运行服务，使私有 nvm 目录正常可用，无需修改家目录权限。服务用户加入 `video`、`audio` 组；安装应用到 `/opt/lanvoryn`，环境与媒体配置到 `/etc/lanvoryn`，可写数据到 `/var/lib/lanvoryn`。首次会在服务器终端交互设置管理员密码，输入不回显，不要在聊天或命令行参数里提供密码。

如需显式指定现有运行时和服务用户：

```bash
bash scripts/install-systemd.sh --node "$(node -p 'process.execPath')" --npm "$(command -v npm)" --user "$(id -un)"
```

如果直接通过 sudo 调用，也应传入这些路径，避免 sudo 替换 PATH。安装器还接受 `LANVORYN_NODE_BIN`、`LANVORYN_NPM_BIN`、`LANVORYN_SERVICE_USER` 覆盖值。纯 root 安装、没有原始调用用户时默认使用独立的 `lanvoryn` 账号，也可以通过 `--user lanvoryn` 主动选择。所选账号必须有权执行所选 Node；权限不匹配会明确报错，不会自动放宽家目录权限。

生成的应用服务使用实际 Node 绝对路径与 `ProtectHome=read-only`，保留只读家目录和 Unix 权限限制，仅应用数据目录可写。每次启动不需要加载 shell 或 nvm。以后删除或切换该 Node 版本时，重新运行安装器更新服务路径即可。`deploy/` 下的文件是模板，需由安装器渲染；本次修改模板不会直接操作服务器。

服务默认开机启动。第一次打开网页后，默认仍停止采集；登录后选择设备与参数再开始。NVIDIA 1050 可选择 `h264_nvenc`，但需要 NVIDIA 驱动和 FFmpeg 的 NVENC 实际可用。未配置真实硬件的机器不要直接套用 GPU 设置。

```bash
sudo systemctl status lanvoryn.service lanvoryn-media.service
sudo journalctl -u lanvoryn.service -u lanvoryn-media.service -f
sudo systemctl restart lanvoryn.service
sudo systemctl stop lanvoryn.service
```

`systemctl stop lanvoryn` 会终止 FFmpeg 子进程并释放设备。网页里的“隐私停止”停止采集且切回手动模式，后台服务仍保持在线以便以后重新开启。

## 5. 防火墙与其他设备观看

仅对实际局域网网段放行。例如你的局域网为 `192.168.1.0/24`：

```bash
sudo ufw allow from 192.168.1.0/24 to any port 3210 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 8189 proto udp
sudo ufw allow from 192.168.1.0/24 to any port 8189 proto tcp
```

在手机、平板或电脑打开 `http://192.168.1.50:3210`，登录并点击“开启声音”。访客账号在“访问安全”页单独设置。Wi-Fi 的客户端隔离、访客网络或 VLAN 规则可能阻止设备互联。

不要对外开放 `8554`、`8889`、`9997`，不要将 MediaMTX 默认播放页面另行代理出去。生成配置还显式关闭了 RTMP、HLS、SRT、MoQ、回放和指标服务，防止升级后的默认监听项扩大暴露面。

## 6. HTTPS（共享或不可信网络）

密码登录控制访问，但局域网 HTTP 不加密登录请求。可用 Caddy/Nginx 做 HTTPS 反向代理到 `127.0.0.1:3210`，保留原 Host，设置：

```dotenv
LANVORYN_HOST=127.0.0.1
LANVORYN_PUBLIC_ORIGIN=https://camera.example.com
LANVORYN_SECURE_COOKIE=true
```

反向代理允许至少 64 KB SDP 请求。WHEP 经过普通 HTTP POST/DELETE，不依赖 WebSocket。WebRTC 媒体仍使用 8189/UDP 或 TCP；只反代网页端口并不能代替媒体网络配置。外网部署还需认证、域名、可达 ICE 地址以及必要时 TURN，详见 [官方连接排障](https://mediamtx.org/docs/features/webrtc-specific-features)；本项目的默认部署范围是局域网。

## 更新、备份与回退

备份 `/etc/lanvoryn`、`/var/lib/lanvoryn` 和原来的 uStreamer 服务文件；凭据备份必须保密。升级时在独立源码目录 `npm ci`、构建、安装上游媒体包并重新运行安装脚本。已有账号和环境文件会保留，媒体配置会采用你本次生成的版本；先检查 IP 和端口。

回退：停止 `lanvoryn` 和 `lanvoryn-media`，运行 `sudo systemctl start ustreamer.service`。不要同时启用两套摄像头采集。需要卸载时先 disable/stop 两个 Lanvoryn 服务，再按实际需要删除部署文件；不要未经备份删除 `/var/lib/lanvoryn`。
