# Verification scope

**English** · [简体中文](VERIFICATION.zh-CN.md)

Completed locally on 2026-10-31:

- Production build and frontend/backend TypeScript checks passed.
- Nine backend/shared tests passed: login, guest isolation, request-origin protection, revision conflicts, session revocation, device capability parsing, input validation, weekly/overnight schedules and daylight-saving behavior.
- Two browser end-to-end flows passed against real FFmpeg → MediaMTX → Chromium transmission: audio/video tracks, audio-only/video-only negotiation, unmute, screenshots, local recording, pause/resume, parameter updates, privacy stop, schedule editing, guest revocation and eight language choices.
- A separate real-browser visual pass confirmed decoded 1280×720 moving test video, increasing playback time/frame count, sound controls, audio-only operation and live language changes. Desktop and 390 px mobile layouts were inspected; the mobile test did not show horizontal overflow.
- The dependency audit after the glob override reported zero known advisories. This is an advisory-database result, not a comprehensive security audit.

A locale key/interpolation consistency test is included. It was added after the completed test run and was not rerun during the final documentation-only wrap-up. The final small additions to translated validation messages were not followed by another complete regression run, during the final documentation-only update.

All media inputs in browser tests were explicitly generated test patterns and a 440 Hz tone. These results do **not** establish real USB capture, sustained hardware-encoder performance, measured end-to-end delay, real microphone audibility, physical phone compatibility, systemd installation or production readiness on the target host.

Before real deployment, accept actual camera/microphone permissions, supported mode combinations, audio synchronization, long-running resource use, LAN reachability from the intended devices, and systemd restart/reboot behavior. These hardware steps are intentionally not represented as completed.
