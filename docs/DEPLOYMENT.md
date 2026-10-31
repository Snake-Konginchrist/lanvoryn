# Linux / Ubuntu deployment

**English** · [简体中文](DEPLOYMENT.zh-CN.md)

Deploy directly on the Linux host with the camera and microphone. systemd manages Lanvoryn and MediaMTX; Docker, a database and a cloud account are unnecessary. macOS can run the explicit demo source, while real capture uses Linux V4L2 + ALSA.

## 1. Runtime and devices

Use your existing Node.js 24+ installation, including nvm installations in your home directory. No specific installation path is required. If Node is missing or too old, choose a current stable LTS using your preferred supported installation method; see [Node.js downloads](https://nodejs.org/en/download).

```bash
node --version
npm --version
sudo apt update
sudo apt install ffmpeg v4l-utils alsa-utils rsync ca-certificates curl git
v4l2-ctl --list-devices
arecord -l
ls -l /dev/v4l/by-id/
v4l2-ctl -d /dev/video0 --list-formats-ext
ffmpeg -hide_banner -encoders
```

These system tools come from your distribution's official supported repositories, which may lag the latest upstream FFmpeg release. For a newer build, follow [FFmpeg's official download guidance](https://ffmpeg.org/download.html). For NVIDIA encoding, verify the installed driver with `nvidia-smi` and test NVENC on the target host.

Prefer a stable `/dev/v4l/by-id/...-video-index0` camera path and an ALSA identifier such as `plughw:Camera,0`. Determine actual names from the device tools; numeric card indexes can change after reboot.

## 2. Build in a dedicated directory

```bash
git clone https://github.com/Snake-Konginchrist/lanvoryn.git
cd lanvoryn
npm ci
cp .env.example .env
```

Edit `.env`, replacing the example IP with the actual server LAN address:

```dotenv
LANVORYN_HOST=0.0.0.0
LANVORYN_PORT=3210
LANVORYN_SOURCE=linux
LANVORYN_MEDIA_HOST=192.168.1.50
```

Use a DHCP reservation if possible. Regenerate the media configuration and restart MediaMTX when the advertised IP changes.

```bash
npm run media:install
npm run media:config
npm run build
```

The installer downloads the latest stable official MediaMTX GitHub release for the current platform and verifies its official SHA-256 checksum. It does not install FFmpeg or GPU drivers. Set `LANVORYN_MEDIAMTX_VERSION=vVERSION` when you need a specific previously tested release.

## 3. Release the camera from uStreamer

When ready to switch, stop the existing capture service:

```bash
sudo systemctl stop ustreamer.service
```

Keep its configuration for rollback. Disable its automatic startup only after the new installation passes hardware acceptance. Two capture processes must not compete for the same camera.

## 4. Install systemd services

```bash
bash scripts/install-systemd.sh
```

Run the installer from the user shell where your preferred Node/npm are available. It resolves the selected Node executable before requesting sudo and defaults to running the services as that user, so private nvm directories remain accessible without permission changes. The service user is added to `video` and `audio`. It installs the application in `/opt/lanvoryn`, environment and media settings in `/etc/lanvoryn`, and writable state in `/var/lib/lanvoryn`. On first installation it prompts for an administrator password in the local terminal without echoing it. Do not put passwords in chat, shell arguments or tracked files.

The first installation prompts for:

1. Your current Linux user's password for `sudo`.
2. `管理员账号 [admin]：`: press Enter to use `admin`, or enter a custom username. This web administrator account is separate from the Linux user.
3. An administrator password of 12–128 characters, followed by confirmation. Password input is hidden.

Credentials are stored in `/var/lib/lanvoryn/credentials.json`; passwords use salted scrypt hashes, without a database. If setup fails, keep the terminal open, address its final error and rerun the installation command. Existing credentials are retained on subsequent installations.

To choose executables or a different service account explicitly:

```bash
bash scripts/install-systemd.sh --node "$(node -p 'process.execPath')" --npm "$(command -v npm)" --user "$(id -un)"
```

When invoking through sudo directly, pass those paths explicitly because sudo may replace PATH. `LANVORYN_NODE_BIN`, `LANVORYN_NPM_BIN` and `LANVORYN_SERVICE_USER` are optional installer overrides. A root-only installation without a caller defaults to the dedicated `lanvoryn` account; `--user lanvoryn` also selects that account explicitly. The selected account must be able to execute the chosen Node; the installer reports incompatible permissions rather than changing home-directory access.

The generated application unit uses the actual absolute Node path and `ProtectHome=read-only`, retaining read-only home access and ordinary Unix ownership permissions. It does not run a shell or initialize nvm at every startup. Only the application state directory is writable. After removing or changing the selected Node version, rerun the installer to update the unit. Unit files in `deploy/` are templates, not files to copy without rendering. This is Linux systemd deployment; no server changes are made by editing these local templates.

Both services start at boot. Capture remains off initially. Open the application, configure actual devices and start capture. Choose NVIDIA NVENC only after testing support; the application reports encoder errors rather than silently changing encoders.

```bash
sudo systemctl status lanvoryn.service lanvoryn-media.service
sudo journalctl -u lanvoryn.service -u lanvoryn-media.service -f
sudo systemctl restart lanvoryn.service
sudo systemctl stop lanvoryn.service
```

Stopping Lanvoryn terminates its FFmpeg process. The web **Privacy stop** action stops capture and selects manual mode while keeping the console available.

## 5. LAN access and firewall

For an actual LAN subnet of `192.168.1.0/24`:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 3210 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 8189 proto udp
sudo ufw allow from 192.168.1.0/24 to any port 8189 proto tcp
```

Other devices can open `http://192.168.1.50:3210`, sign in and enable sound. Guest credentials are configured separately in Access & security. Check Wi-Fi client isolation, guest networks and VLAN rules if devices cannot connect.

Do not expose 8554, 8889 or 9997 or separately proxy the raw MediaMTX player. Generated configuration also disables RTMP, HLS, SRT, MoQ, playback and metrics listeners.

## 6. HTTPS and reverse proxies

Password authentication controls access; HTTP does not encrypt login data. On shared or untrusted networks use a trusted TLS certificate and Caddy/Nginx forwarding to `127.0.0.1:3210`, preserving the original Host:

```dotenv
LANVORYN_HOST=127.0.0.1
LANVORYN_PUBLIC_ORIGIN=https://camera.example.com
LANVORYN_SECURE_COOKIE=true
```

Permit SDP requests of at least 64 KB. WHEP uses HTTP POST/DELETE, not WebSockets. Media still needs 8189/UDP or TCP; proxying the web page alone does not make the media channel reachable. Internet access additionally requires reachable ICE addresses and possibly TURN. Follow [MediaMTX connectivity guidance](https://mediamtx.org/docs/features/webrtc-specific-features); the default deployment target is a LAN.

## Updates and rollback

Back up `/etc/lanvoryn`, `/var/lib/lanvoryn` and the original uStreamer unit. Protect credential backups. Update from a separate source checkout, run `npm ci`, build, install and regenerate the desired media release, then rerun the installation script. Existing accounts and the deployed environment file are retained; the newly generated media configuration replaces the previous one, so check IPs and ports first.

To roll back, stop `lanvoryn` and `lanvoryn-media`, then start `ustreamer.service`. Do not run both camera capture pipelines. To uninstall, disable and stop both Lanvoryn units, then remove deployment files as appropriate; retain state until you have a verified backup.
