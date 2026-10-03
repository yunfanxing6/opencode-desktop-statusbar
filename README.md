# OpenCode Desktop Statusbar

An open source macOS desktop adapter that adds a bottom status bar to OpenCode. It shows the current project, selected or executing model, context usage, token totals, cost, session state, and generation throughput.

The project targets the Electron desktop build of OpenCode **1.18.34**. The upstream plugin API is server side and does not provide a desktop UI mount point, so this project keeps the UI and metrics in a small adapter component and applies it to a pinned upstream source checkout.

## Features

- Project directory, project name, Git branch, session title and session ID.
- Provider, model ID, model display name, agent and variant.
- Recent request context tokens and model context limit.
- Input, output, reasoning and cache read/write token breakdown.
- Session cumulative tokens and cost.
- Idle, generating, tool, waiting, compacting, retry, error and cancelled states.
- Live estimated tok/s and completed request throughput.
- Shadow DOM styling that follows OpenCode’s theme variables.
- Responsive layout for narrow windows, configurable fields, Chinese and English labels.
- Backup, install and restore commands with an OpenCode version check.

## Install from source

```sh
npm install
npm test
npm run desktop:check
npm run desktop:install
```

`desktop:install` prepares the pinned OpenCode source checkout in `artifacts/upstream`, builds with `OPENCODE_CHANNEL=prod` and `OPENCODE_VERSION=1.18.34`, and installs the statusbar renderer. It preserves the installed main process, embedded server, native modules and production storage identity, backs up `app.asar` and `Info.plist`, updates ASAR integrity, and re-signs the app. Quit OpenCode before installing, then launch it again. Both desktop and server identities are validated before installation.

An earlier installer omitted the release build environment. This selected `ai.opencode.desktop.dev` for desktop settings and `opencode-.db` for sessions, making existing production history appear missing. The original data remains in `ai.opencode.desktop` and `~/.local/share/opencode/opencode.db`. To repair an affected installation while keeping the statusbar:

```sh
npm run desktop:repair
```

Repair combines the original production runtime from the earliest verified backup with the current statusbar renderer. Quit and reopen OpenCode afterward. Production settings restore the project list and the agent selector (including Build and Plan). Sessions created in the affected Dev build remain in `opencode-.db`; repair does not overwrite or merge either database.

If you already built the patched app, skip the source build:

```sh
OPENCODE_STATUSBAR_APP="/path/to/OpenCode.app" npm run desktop:install
```

The installed app must report version `1.18.34`. Use `OPENCODE_APP` when OpenCode is installed somewhere else.

Restore the earliest verified production backup (the original app) with:

```sh
npm run desktop:uninstall
```

## Build the adapter

```sh
npm run build
```

The source adapter is copied into the upstream app package by `scripts/prepare-source.mjs`. The app calls `useOpenCodeStatusbar()` from `SessionPage`, so the component has access to the same reactive session, project, provider and event contexts as the native UI.

## Metric definitions

Context usage follows OpenCode’s native context indicator: input + output + reasoning + cache read/write from the most recent assistant request with token usage. The denominator is that request’s model context limit.

Live speed is an estimate based on observed streamed text and reasoning characters. It is labelled with `≈` and is never derived from the number of stream chunks. Completed throughput uses reported output and reasoning tokens divided by measured text/reasoning intervals, excluding tool execution intervals. Historical requests without timing data show no speed.

## Compatibility

The desktop adapter is pinned to OpenCode 1.18.34 because OpenCode desktop bundles are versioned and the internal component tree can change. `desktop:check` and the installer refuse other versions. A future release can add a new adapter directory after checking the upstream session and event APIs.

### DEV badge

The `DEV` badge is the renderer's build channel, not an account or model setting. The first build used OpenCode's default development channel. Rebuilding with `OPENCODE_CHANNEL=prod` removes it. For an installation whose main/server identities are already production but whose UI still displays `DEV`, run:

```sh
node scripts/fix-renderer-channel.mjs
```

This rebuilds the renderer with the production channel and preserves the installed production runtime. Completely quit and reopen OpenCode afterward.

### Updating OpenCode

Official OpenCode updates replace the application resources and normally remove this statusbar patch. Install the official update, then wait for an adapter release matching that OpenCode version before reinstalling the statusbar. This release supports **1.18.34 only**; do not change the version guard to install it on a newer version.

The local patch uses an ad-hoc macOS signature. Although the production updater and official update feed remain present, an in-app update may fail signature validation. Download and install the official macOS application when that happens; this restores the vendor signature. Replacing the app does not itself delete OpenCode's separate user data directory.

## License

MIT.
