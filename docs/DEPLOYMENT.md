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

## 3. Release devices from other applications (if needed)

Skip this step if no other application uses the devices. Otherwise, stop the conflicting capture application before switching. For an existing uStreamer systemd service, for example:

```bash
sudo systemctl stop ustreamer.service
```

This stops that service; it does not uninstall uStreamer. Keep the previous configuration for rollback and disable automatic startup only after the new installation passes hardware acceptance. The same applies to other camera or microphone capture services.

## 4. Install systemd services

```bash
bash scripts/install-systemd.sh
```

Run the installer from the user shell where your preferred Node/npm are available. It resolves the selected Node executable before requesting sudo and defaults to running the services as that user, so private nvm directories remain accessible without permission changes. The service user is added to `video` and `audio`. It installs the application in `/opt/lanvoryn`, environment and media settings in `/etc/lanvoryn`, and writable state in `/var/lib/lanvoryn`. On first installation it prompts for an administrator password in the local terminal without echoing it. Do not put passwords in chat, shell arguments or tracked files.

The first installation prompts for:

1. Your current Linux user's password for `sudo`.
2. Administrator username: press Enter to use `admin`, or enter a custom username. This web administrator account is separate from the Linux user.
3. An administrator password of 12–128 characters, followed by confirmation. Password input is hidden.

Credentials are stored in `/var/lib/lanvoryn/credentials.json`; passwords use salted scrypt hashes, without a database. If setup fails, keep the terminal open, address its final error and rerun the installation command. Existing credentials are retained on subsequent installations.

To choose executables or a different service account explicitly:

```bash
bash scripts/install-systemd.sh --node "$(node -p 'process.execPath')" --npm "$(command -v npm)" --user "$(id -un)"
```

When invoking through sudo directly, pass those paths explicitly because sudo may replace PATH. `LANVORYN_NODE_BIN`, `LANVORYN_NPM_BIN` and `LANVORYN_SERVICE_USER` are optional installer overrides. A root-only installation without a caller defaults to the dedicated `lanvoryn` account; `--user lanvoryn` also selects that account explicitly. The selected account must be able to execute the chosen Node; the installer reports incompatible permissions rather than changing home-directory access.

The generated application unit uses the actual absolute Node path and `ProtectHome=read-only`, retaining read-only home access and ordinary Unix ownership permissions. It does not run a shell or initialize nvm at every startup. Only the application state directory is writable. After removing or changing the selected Node version, rerun the installer to update the unit. Unit files in `deploy/` are templates rendered by the installer.

Both services start at boot. Viewing is disabled on first installation. Sign in, select actual devices in Capture settings and save, then click Start capture in Live monitor to allow viewing. Devices are opened only for active playback; an idle service leaves them free. Choose NVIDIA NVENC only after testing support; the application reports encoder errors rather than silently changing encoders.

```bash
sudo systemctl status lanvoryn.service lanvoryn-media.service
sudo journalctl -u lanvoryn.service -u lanvoryn-media.service -f
sudo systemctl restart lanvoryn.service
sudo systemctl stop lanvoryn.service
```

Press `q` to leave the status pager, or use `systemctl --no-pager status lanvoryn lanvoryn-media`. Press Ctrl+C to stop following the journal.

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

Back up `/etc/lanvoryn` and `/var/lib/lanvoryn`; protect credential backups. In your source checkout, pull the desired update, run `npm ci`, install the desired media release, regenerate its configuration, build and rerun the installer:

```bash
git pull --ff-only
npm ci
npm run media:install
npm run media:config
npm run build
bash scripts/install-systemd.sh
```

Existing accounts and `/etc/lanvoryn/lanvoryn.env` are retained. The generated media configuration replaces the deployed one: check that the source `.env` has the intended media address and ports before generating it. Refresh open browser tabs after updating. From v0.1.2 onward, valid sessions survive normal application restarts. Upgrading from v0.1.1 requires signing in once because older sessions existed only in memory. Replace the old `LANVORYN_SESSION_HOURS` setting with the idle and maximum limits described in the [session configuration](CONFIGURATION.md#login-sessions).

To roll back Lanvoryn, check out the previous release in your source directory, rebuild and reinstall it, restoring the matching configuration and state backup if necessary. If migrating from another capture application, also retain its service configuration; stop both Lanvoryn units before restoring that application. To uninstall, disable and stop both Lanvoryn units, then remove deployment files as appropriate; retain state until you have a verified backup.

## IP geolocation

Administrators can view IP locations in the Access & security session list. The server queries [FreeIPAPI](https://freeipapi.com/) over HTTPS for public addresses, without an account or API key. This sends the queried public IP to that provider. Local and reserved addresses are classified locally and never submitted. Country names follow the UI language; region and city names retain the provider’s spelling. IP locations are approximate and do not identify a device’s physical position.

`LANVORYN_IP_GEOLOCATION=true` is enabled by default. Set it to `false` and restart the application to disable public lookups. Successful results stay in memory for 24 hours and failures for one minute. Queries are deduplicated and limited to eight per ten seconds. The provider currently allows 60 per minute and ten per ten seconds on its free plan. Errors and timeouts do not affect authentication or playback. Only session addresses are queried; event logs retain their original IPs.

With `trustProxy=false`, the connection peer is used. Behind a reverse proxy this may be the proxy address; arbitrary forwarded client headers are not trusted.

## On-demand capture

An online service does not keep devices open. In an allowed viewing period, each player requests only the inputs it needs: video-only does not request a microphone and audio-only does not request a camera. Multiple players share the union of their requested inputs, so another player may keep an input in use. Pausing, leaving the playback page, moving it to the background or closing it releases that player’s demand. An explicit local recording can continue in the background. Capture stops after the final player leaves. If a browser disappears without cleanup, its demand expires 30 seconds after its last heartbeat and is reclaimed within approximately two more seconds.

Schedules and continuous availability determine when playback is permitted; idle devices are still released. Privacy stop blocks playback and disconnects current players. Browser mute only affects local output; select video-only to avoid requesting audio. Changes to the active track combination can briefly reconnect other players.
