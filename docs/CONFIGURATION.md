# Configuration and troubleshooting

**English** · [简体中文](CONFIGURATION.zh-CN.md)

## Environment and state

See `.env.example`. `LANVORYN_SOURCE=linux` selects real devices; `demo` explicitly generates test video and a 440 Hz tone. There is no automatic demo fallback. `LANVORYN_MEDIA_HOST` advertises a reachable media address, while `LANVORYN_PUBLIC_ORIGIN` controls allowed request origin behind a proxy.

`LANVORYN_ALLOWED_CIDRS` accepts comma-separated IPv4/IPv6 networks. If enabled, include every required client and loopback management address. State lives under `LANVORYN_DATA_DIR` (`/var/lib/lanvoryn` for systemd): password hashes in `credentials.json`, hashed login sessions in `sessions.json`, revisioned settings in `config.json`, and the latest 200 events in `events.json`. Exported settings exclude credentials.

For systemd deployments, the running service reads `/etc/lanvoryn/lanvoryn.env`. The source checkout’s `.env` is copied only on first installation; reinstalling preserves the deployed environment file. After editing it, run `sudo systemctl restart lanvoryn`. If `LANVORYN_MEDIA_HOST` changes, regenerate and install the media configuration too; restarting the application alone is insufficient.

## Login sessions

`LANVORYN_SESSION_IDLE_HOURS=168` expires a login after seven days without use. `LANVORYN_SESSION_MAX_HOURS=720` sets a thirty-day absolute maximum from login; renewal never extends that deadline. Both values are configurable, up to 720 hours. The old fixed `LANVORYN_SESSION_HOURS` setting is no longer read.

Opening or returning to a visible page, pointer/keyboard input and active playback renew the idle period. Renewal timestamps are persisted at most once per minute per session. Background status polling does not count as activity. Explicit browser-local recording may continue to renew playback in the background. Cookies are renewed with the remaining lifetime through the same-origin API.

Session records are saved atomically in `sessions.json` under the data directory with mode `0600`; only SHA-256 hashes of random tokens are stored, not reusable cookie values. Valid sessions survive normal restarts. Logout, password changes and administrator revocation invalidate affected sessions, including after restart. Offline credential resets also invalidate the previous account's saved sessions. Upgrading from v0.1.1 requires one new login because old sessions were memory-only.

## Capture settings

Default video is 1080p30, 4 Mbps and CPU libx264. Test devices before choosing NVENC or 4K. Presets only fill settings; they cannot add device capabilities. On Linux, the API checks camera resolution/frame-rate/format combinations when changed. MJPEG is preferred; raw YUYV often hits USB bandwidth limits. H.264 uses baseline without B-frames, with a one-to-five-second keyframe interval. A 90°/270° rotation swaps the displayed dimensions.

Hardware controls are discovered from the camera, including menu/range and read-only restrictions. They apply immediately, are not included in configuration exports and may reset when the camera loses power. Save a newly selected camera before changing its hardware controls.

Input audio rate must be supported by the device. Opus output uses 48 kHz, with configurable mono/stereo and 16–256 kbps. Capture gain affects every viewer; playback volume affects only the current device. Frequency-domain denoising and a 100 Hz high-pass filter are optional and may alter sound. Positive A/V offset delays audio, negative delays video. Measure before adjusting.

## Troubleshooting

| Symptom                         | Check                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Page opens, media fails         | 8189/UDP and TCP, advertised LAN IP, Wi-Fi/VLAN isolation, MediaMTX status                                            |
| Video works, sound is absent    | Enable sound, select an audio-capable playback mode, check audio input/rate/channels and logs                         |
| Camera is busy                  | Stop uStreamer, meeting software or other capture processes                                                           |
| Permission denied               | Service user's video/audio groups and device permissions; restart after group changes                                 |
| NVENC fails                     | Driver, FFmpeg encoder support and GPU resources; choose CPU explicitly if necessary                                  |
| Delay or stuttering             | Lower resolution/bitrate/frame rate; inspect USB bandwidth and CPU/GPU use; low RTT does not prove low encoding delay |
| Login immediately expires       | Secure cookies on plain HTTP, proxy Host, PUBLIC_ORIGIN, server clock and session lifetime                            |
| Save returns 409                | Another console updated settings. Reload before editing again                                                         |
| Write request rejected          | Same origin, preserved Host, X-Lanvoryn-Request: 1 header; do not enable arbitrary cross-origin access                |
| Privacy stop changed scheduling | Manual operations intentionally select manual mode; restore scheduled mode explicitly                                 |

## Preferences

Open Preferences on the login page or at the bottom of the console sidebar to choose the language and system, light or dark theme. These choices are saved in the browser. Bundled i18next resources cover Simplified/Traditional Chinese, English, Japanese, Korean, Spanish, French and German. Browser language is detected initially; `zh-Hant`, `zh-TW`, `zh-HK` and `zh-MO` select Traditional Chinese.

Device names, V4L2 identifiers and raw FFmpeg/system diagnostics retain their original technical text. Displayed dates follow the selected language, while capture windows always execute in the saved schedule time zone.

## IP geolocation

Administrators can view IP locations in the Access & security session list. The server queries [FreeIPAPI](https://freeipapi.com/) over HTTPS for public addresses, without an account or API key. This sends the queried public IP to that provider. Local and reserved addresses are classified locally and never submitted. Country names follow the UI language; region and city names retain the provider’s spelling. IP locations are approximate and do not identify a device’s physical position.

`LANVORYN_IP_GEOLOCATION=true` is enabled by default. Set it to `false` and restart the application to disable public lookups. Successful results stay in memory for 24 hours and failures for one minute. Queries are deduplicated and limited to eight per ten seconds. The provider currently allows 60 per minute and ten per ten seconds on its free plan. Errors and timeouts do not affect authentication or playback. Only session addresses are queried; event logs retain their original IPs.

With `trustProxy=false`, the connection peer is used. Behind a reverse proxy this may be the proxy address; arbitrary forwarded client headers are not trusted.

## Page URLs

`/login` signs in; `/live` monitors the stream; `/settings` configures capture; `/schedules` manages schedules; `/security` manages access; `/events` shows logs. Direct links, refresh and browser history are supported. Guests can only access live monitoring.

## On-demand capture

An online service does not keep devices open. In an allowed viewing period, each player requests only the inputs it needs: video-only does not request a microphone and audio-only does not request a camera. Multiple players share the union of their requested inputs, so another player may keep an input in use. Pausing, leaving the playback page, moving it to the background or closing it releases that player’s demand. An explicit local recording can continue in the background. Capture stops after the final player leaves. If a browser disappears without cleanup, its demand expires 30 seconds after its last heartbeat and is reclaimed within approximately two more seconds.

Schedules and continuous availability determine when playback is permitted; idle devices are still released. Privacy stop blocks playback and disconnects current players. Browser mute only affects local output; select video-only to avoid requesting audio. Changes to the active track combination can briefly reconnect other players.
