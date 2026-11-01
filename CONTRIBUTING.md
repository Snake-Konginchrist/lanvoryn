# Contributing

**English** · [简体中文](CONTRIBUTING.zh-CN.md)

Use a current stable Node.js LTS and npm. Install with `npm ci`; add or upgrade a direct dependency with `npm install PACKAGE@latest -w WORKSPACE`, and remove it with `npm uninstall PACKAGE -w WORKSPACE`. Commit the lockfile. Do not edit dependency source.

Before submitting, run `npm run check`, `npm run lint`, `npm test` and `npm run build`. Changes to playback, permissions or capture also require `npm run test:e2e`. Hardware reports should identify the OS, camera mode, encoder and browser. Do not present synthetic tests as real-camera acceptance.

Browser tests also need FFmpeg, the MediaMTX binary and Playwright Chromium. Install the test dependencies with `npm run media:install` and `npx playwright install chromium`, then run `npm run test:e2e`. The test stack creates its own temporary account and state under `.runtime/e2e`; it uses generated video and audio instead of physical devices.

Keep English and Simplified Chinese documentation synchronized. Public screenshots must use isolated demo data, generated media, and example hostnames and addresses, without real device details or credentials.

Keep shared validation/scheduling, server device/security logic and browser presentation separate. Never add endpoints accepting arbitrary commands, filter expressions or media URLs. Locale files must have identical keys and interpolation variables. Passwords, tokens and SDP do not belong in locale resources or browser persistent storage.

## What belongs in Git

Commit application and shared source, all locale resources, deliberate UI/documentation assets, tests, deployment templates, setup scripts, documentation, LICENSE, sanitized `.env.example` templates, shared tooling configuration, `package.json` and `package-lock.json`. The repository `.npmrc` only selects the public registry; authentication tokens must stay in the user's private npm configuration.

Do not commit installed dependencies, compiled output, caches, downloaded media binaries, local `.env` files, account/session data, runtime settings, logs, coverage/browser reports, recordings, backups, generated TLS certificates or private keys. Keep runtime output under `.runtime/` or the configured data directory. Shared editor configuration is allowed; personal IDE state is ignored.

The root `.gitignore` owns these rules for all workspaces. Ignore rules do not untrack staged files: remove an accidentally staged secret with `git rm --cached -- PATH`, preserving the local file. If it already entered published history, removing it from the latest tree is insufficient; revoke it and follow a coordinated history-cleanup process.
