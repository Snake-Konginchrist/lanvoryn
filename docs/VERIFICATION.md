# Verification scope

**English** · [简体中文](VERIFICATION.zh-CN.md)

Completed locally on 2026-10-31:

- Production build and frontend/backend TypeScript checks passed.
- Nine backend/shared tests passed: login, guest isolation, request-origin protection, revision conflicts, session revocation, device capability parsing, input validation, weekly/overnight schedules and daylight-saving behavior.
- Two browser end-to-end flows passed against real FFmpeg → MediaMTX → Chromium transmission: audio/video tracks, audio-only/video-only negotiation, unmute, screenshots, local recording, pause/resume, parameter updates, privacy stop, schedule editing, guest revocation and eight language choices.
- A separate real-browser visual pass confirmed decoded 1280×720 moving test video, increasing playback time/frame count, sound controls, audio-only operation and live language changes. Desktop and 390 px mobile layouts were inspected; the mobile test did not show horizontal overflow.
- The dependency audit after the glob override reported zero known advisories. This is an advisory-database result, not a comprehensive security audit.

Latest source validation: production build and all 35 tests passed, including eight-language key/interpolation coverage and IP geolocation tests for private/reserved-address exclusion, caching, request deduplication, rate limiting, failure handling, and preserving configuration drafts during saves and capture controls, and route mapping, login destinations and navigation history. The free provider was reachable from the deployment host. Earlier browser results above predate the latest UI copy and geolocation changes; those changes have not received another complete browser pass.

All media inputs in the earlier browser tests were explicitly generated test patterns and a 440 Hz tone. These results do **not** establish real USB capture, sustained hardware-encoder performance, measured end-to-end delay, real microphone audibility, physical phone compatibility, systemd installation or production readiness on the target host.

Before real deployment, accept actual camera/microphone permissions, supported mode combinations, audio synchronization, long-running resource use, LAN reachability from the intended devices, and systemd restart/reboot behavior. Deployment smoke checks have confirmed active systemd services, real H.264/Opus capture and an established WebRTC reader sending media packets. Long-running stability, measured latency and physical-device browser compatibility remain outside that check.

2026-11-01: on-demand capture was checked through authenticated HTTP requests with real FFmpeg and MediaMTX synthetic inputs. No player produced no capture process; video-only, combined and audio-only demands produced the corresponding track sets; removing the last demand stopped capture; an abandoned demand expired and released capture automatically. A real WHEP negotiation after on-demand startup succeeded. No user browser was automated for these checks.

2026-11-01: frontend request tests distinguish an anonymous session probe from an expired authenticated request and confirm that a delayed 401 from before a successful login cannot invalidate the new session.

2026-11-01: English and Simplified Chinese README screenshots were captured from an isolated local demo with real WebRTC playback of generated 1280×720 video. The 1440×1080 desktop view showed the player, controls and sidebar without clipping or horizontal overflow. Pause/resume and audio-only/video-only input selection were checked; no browser script errors occurred. Displayed host details were replaced with examples. The demo browser and processes were closed afterward; no physical capture devices were used.

2026-11-02: persistent sessions were checked for seven-day idle expiry, sliding renewal capped at thirty days, restart recovery, durable revocation and offline credential resets. HTTP checks confirmed that status polling does not renew a session while activity and playback do. Production build, type checks, lint and 35 tests passed; both synthetic WebRTC browser flows passed, including guest isolation and all eight languages. Login typography was visually reviewed in desktop and mobile viewports with both themes; language-specific bundled fonts loaded successfully. No physical capture devices or existing user browser profiles were used.
