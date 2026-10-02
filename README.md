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

`desktop:install` prepares the pinned OpenCode source checkout in `artifacts/upstream`, builds a patched desktop app, backs up the installed `app.asar`, replaces it, and re-signs the local app with an ad-hoc signature. Quit OpenCode before installing, then launch it again.

If you already built the patched app, skip the source build:

```sh
OPENCODE_STATUSBAR_APP="/path/to/OpenCode.app" npm run desktop:install
```

The installed app must report version `1.18.34`. Use `OPENCODE_APP` when OpenCode is installed somewhere else.

Restore the most recent backup with:

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

## License

MIT.
