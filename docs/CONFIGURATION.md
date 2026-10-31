# Configuration and troubleshooting

**English** · [简体中文](CONFIGURATION.zh-CN.md)

## Environment and state

See `.env.example`. `LANVORYN_SOURCE=linux` selects real devices; `demo` explicitly generates test video and a 440 Hz tone. There is no automatic demo fallback. `LANVORYN_MEDIA_HOST` advertises a reachable media address, while `LANVORYN_PUBLIC_ORIGIN` controls allowed request origin behind a proxy.

`LANVORYN_ALLOWED_CIDRS` accepts comma-separated IPv4/IPv6 networks. If enabled, include every required client and loopback management address. State lives under `LANVORYN_DATA_DIR` (`/var/lib/lanvoryn` for systemd): password hashes in `credentials.json`, revisioned settings in `config.json`, and the latest 200 events in `events.json`. Exported settings exclude credentials.

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
| Write request rejected          | Same origin, preserved Host, X-Lanvoryn-Request: 1 header; do not enable arbitrary cross-origin access                   |
| Privacy stop changed scheduling | Manual operations intentionally select manual mode; restore scheduled mode explicitly                                 |

## Languages

Bundled i18next resources cover Simplified/Traditional Chinese, English, Japanese, Korean, Spanish, French and German. Browser language is detected and can be overridden on the login page or console. `zh-Hant`, `zh-TW`, `zh-HK` and `zh-MO` select Traditional Chinese.

Device names, V4L2 identifiers and raw FFmpeg/system diagnostics retain their original technical text. Displayed dates follow the selected language, while capture windows always execute in the saved schedule time zone.
