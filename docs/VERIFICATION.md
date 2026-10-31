# Verification scope

**English** · [简体中文](VERIFICATION.zh-CN.md)

Completed locally on 2026-10-31:

- Production build and frontend/backend TypeScript checks passed.
- Nine backend/shared tests passed: login, guest isolation, request-origin protection, revision conflicts, session revocation, device capability parsing, input validation, weekly/overnight schedules and daylight-saving behavior.
- Two browser end-to-end flows passed against real FFmpeg → MediaMTX → Chromium transmission: audio/video tracks, audio-only/video-only negotiation, unmute, screenshots, local recording, pause/resume, parameter updates, privacy stop, schedule editing, guest revocation and eight language choices.
- A separate real-browser visual pass confirmed decoded 1280×720 moving test video, increasing playback time/frame count, sound controls, audio-only operation and live language changes. Desktop and 390 px mobile layouts were inspected; the mobile test did not show horizontal overflow.
- The dependency audit after the glob override reported zero known advisories. This is an advisory-database result, not a comprehensive security audit.

Latest source validation: production build and all 17 tests passed, including eight-language key/interpolation coverage and IP geolocation tests for private/reserved-address exclusion, caching, request deduplication, rate limiting and failure handling. The free provider was reachable from the deployment host. Earlier browser results above predate the latest UI copy and geolocation changes; those changes have not received another complete browser pass.

All media inputs in the earlier browser tests were explicitly generated test patterns and a 440 Hz tone. These results do **not** establish real USB capture, sustained hardware-encoder performance, measured end-to-end delay, real microphone audibility, physical phone compatibility, systemd installation or production readiness on the target host.

Before real deployment, accept actual camera/microphone permissions, supported mode combinations, audio synchronization, long-running resource use, LAN reachability from the intended devices, and systemd restart/reboot behavior. These hardware steps are intentionally not represented as completed.
