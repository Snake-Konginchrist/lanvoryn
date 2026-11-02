# Linux / Ubuntu 部署

[English](DEPLOYMENT.md) · **简体中文**

推荐直接部署到有摄像头和麦克风的 Linux 主机，使用 systemd 管理应用和 MediaMTX。无需 Docker，无需数据库或云账号。macOS 可用 `demo` 源开发，真实采集管线使用 Linux V4L2 + ALSA。

## 1. 准备运行时和设备

直接使用现有 Node.js 24+，包括安装在用户家目录中的 nvm 版本，不要求移动或重新安装到任何指定目录。只有未安装或版本不足时，才需要按自己选择的受支持方式安装稳定 LTS，参考 [Node.js 官方下载页](https://nodejs.org/en/download)。

```bash
node --version
npm --version
sudo apt update
sudo apt install ffmpeg v4l-utils alsa-utils rsync ca-certificates curl git
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

在独立源码文件夹中执行：

```bash
git clone https://github.com/Snake-Konginchrist/lanvoryn.git
cd lanvoryn
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

## 3. 释放其他应用占用的设备（按需）

没有其他应用占用设备时，跳过此步；否则，切换前先停止原采集应用。例如，已有 uStreamer systemd 服务时运行：

```bash
sudo systemctl stop ustreamer.service
```

此命令只停止服务，不卸载 uStreamer 软件。保留原配置用于回退，在新方案通过真机验收后再决定是否禁用原服务的开机启动。其他占用摄像头或麦克风的服务同样处理。

## 4. 安装 systemd 服务

```bash
bash scripts/install-systemd.sh
```

请从已加载所需 Node/npm 的用户终端运行安装器。脚本在申请 sudo 之前解析当前选中的 Node 路径，并默认使用该用户运行服务，使私有 nvm 目录正常可用，无需修改家目录权限。服务用户加入 `video`、`audio` 组；安装应用到 `/opt/lanvoryn`，环境与媒体配置到 `/etc/lanvoryn`，可写数据到 `/var/lib/lanvoryn`。首次会在服务器终端交互设置管理员密码，输入不回显，不要在聊天或命令行参数里提供密码。

首次安装依次出现以下提示：

1. `sudo` 密码：输入服务器上当前 Linux 用户的密码。
2. `管理员账号 [admin]：`：直接回车使用 `admin`，也可输入自定义账号。这是网页管理员账号，与 Linux 用户无关。
3. 管理员密码：输入 12–128 个字符的密码，再次输入确认；输入时不显示字符。

账号保存于 `/var/lib/lanvoryn/credentials.json`，密码以带随机盐的 scrypt 哈希保存，不使用数据库。若设置失败，不要关闭终端；根据最后的错误修正后重新运行安装命令。已有凭据的安装会保留原账号。

如需显式指定现有运行时和服务用户：

```bash
bash scripts/install-systemd.sh --node "$(node -p 'process.execPath')" --npm "$(command -v npm)" --user "$(id -un)"
```

如果直接通过 sudo 调用，也应传入这些路径，避免 sudo 替换 PATH。安装器还接受 `LANVORYN_NODE_BIN`、`LANVORYN_NPM_BIN`、`LANVORYN_SERVICE_USER` 覆盖值。纯 root 安装、没有原始调用用户时默认使用独立的 `lanvoryn` 账号，也可以通过 `--user lanvoryn` 主动选择。所选账号必须有权执行所选 Node；权限不匹配会明确报错，不会自动放宽家目录权限。

生成的应用服务使用实际 Node 绝对路径与 `ProtectHome=read-only`，保留只读家目录和 Unix 权限限制，仅应用数据目录可写。每次启动不需要加载 shell 或 nvm。以后删除或切换该 Node 版本时，重新运行安装器更新服务路径即可。`deploy/` 下的文件是模板，由安装器渲染。

两个服务默认开机启动，首次安装后尚未开放观看。登录后在“采集参数”中选择设备并保存，再到“实时监看”点击“开始采集”开放观看；设备只在有播放需求时占用，服务空闲时会释放。选择 NVIDIA NVENC 前应先验证驱动与 FFmpeg 支持，编码失败会明确报错，不会自动切换编码器。

```bash
sudo systemctl status lanvoryn.service lanvoryn-media.service
sudo journalctl -u lanvoryn.service -u lanvoryn-media.service -f
sudo systemctl restart lanvoryn.service
sudo systemctl stop lanvoryn.service
```

状态分页界面按 `q` 退出，也可使用 `systemctl --no-pager status lanvoryn lanvoryn-media`。跟随日志时按 Ctrl+C 结束查看。

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

备份 `/etc/lanvoryn` 和 `/var/lib/lanvoryn`，凭据备份必须保密。在源码目录拉取更新、安装依赖和所需媒体版本、重新生成媒体配置、构建并运行安装器：

```bash
git pull --ff-only
npm ci
npm run media:install
npm run media:config
npm run build
bash scripts/install-systemd.sh
```

已有账号和 `/etc/lanvoryn/lanvoryn.env` 会保留。新生成的媒体配置会替换部署中的版本，生成前先确认源码 `.env` 中的媒体地址和端口正确。升级后刷新已打开的网页。v0.1.2 起，有效登录在应用正常重启后保留；从 v0.1.1 首次升级时需重新登录一次，因为旧会话只保存在内存中。原 `LANVORYN_SESSION_HOURS` 应替换为[登录会话配置](CONFIGURATION.zh-CN.md#登录会话)中的闲置和最长有效期设置。

回退 Lanvoryn 时，在源码目录切换到之前的 Release，重新构建和安装，必要时恢复匹配的配置与数据备份。从其他采集应用迁移时，还应保留原应用的服务配置；恢复原应用前先停止两个 Lanvoryn 服务。卸载时先禁用并停止这两个服务，再按需删除部署文件；数据应保留到备份确认可用后再处理。

## IP 属地

管理员在“访问安全”的会话列表中查看 IP 属地。公网地址由服务器通过 HTTPS 查询 [FreeIPAPI](https://freeipapi.com/)，无需账号或密钥；查询会向该服务发送被查询的公网 IP。局域网和保留地址在本地识别，不外发。国家名称随界面语言显示，省市名称使用数据源原文。属地是 IP 的大致位置，不代表设备实际位置。

`LANVORYN_IP_GEOLOCATION=true` 默认开启；设为 `false` 并重启应用可关闭公网查询。成功结果内存缓存 24 小时，失败缓存 1 分钟；每 10 秒最多 8 次请求，并合并同一 IP 的并发查询。官方免费档当前为每分钟 60 次、每 10 秒 10 次；超限、超时或不可用时显示状态，不影响登录和播放。只查询会话列表，事件日志继续记录原始 IP。

当前 `trustProxy=false`，使用实际连接来源；反向代理后可能显示代理 IP，不信任任意客户端转发头。

## 按需采集

服务在线不代表持续采集。在允许观看的时段，每个播放器只请求所需输入：仅视频不请求麦克风，仅音频不请求摄像头。多个观看者的需求合并，因此其他观看者仍可能占用某个输入。暂停、离开播放页、切到后台或关闭网页后撤销该播放器的需求，主动开启的本地录制可在后台继续；最后一个观看者离开后停止采集。异常断网或浏览器未发出关闭请求时，需求在最后一次心跳后 30 秒到期，后台在约 2 秒内回收。

定时计划和持续开放控制可观看的时段，无人播放时仍释放设备。“隐私停止”会禁止观看并断开现有播放。浏览器默认静音仅控制本机输出；如只要画面，请选择“仅视频”。播放轨道组合变化可能短暂重连其他观看者。
