## Local run notes (Desktop build) – Oct 9, 2025

This document records the minimal, effective changes made locally to get VS Code desktop running on macOS (darwin-arm64) in this workspace.

### 1) Sync from upstream
- Added `upstream` remote and merged `upstream/main` into local `main`.
- Resolved conflict in `remote/.npmrc` to use the latest upstream values:
  - `target="22.19.0"`
  - `ms_build_id="360633"`

### 2) Dependency install
- Ran `npm ci` at repo root successfully (Node v20.18.0 active in shell during run).

### 3) ESM/CJS loader fixes (temporary, local-only)
- File: `node_modules/@vscode/gulp-electron/src/download.js`
  - Commented out CJS requires of ESM-only packages:
    - `@electron/get`
    - `@octokit/rest`
    - `got`
  - Replaced with dynamic imports inside functions:
    - In `getDownloadUrl(...)`:
      - `const { Octokit } = await import("@octokit/rest");`
    - In the HEAD request before resolving final asset URL:
      - `const { got } = await import("got");`
    - In `download(...)` before performing the artifact fetch:
      - `const { downloadArtifact } = await import("@electron/get");`

Notes:
- These edits are applied directly under `node_modules/` to unblock the run due to ESM boundaries. They are NOT source-controlled and may be overwritten by reinstall. Keep this file as reference.

### 4) Electron acquisition via mirror (network timeouts workaround)
- Official electron download timed out in our environment, so we manually downloaded Electron 37.6.0 from a mirror and staged it as the runtime:
  - Download:
    - `curl -L https://npmmirror.com/mirrors/electron/37.6.0/electron-v37.6.0-darwin-arm64.zip -o .build/electron/electron-v37.6.0-darwin-arm64.zip`
  - Extract non-interactively:
    - `cd .build/electron && unzip -o -q electron-v37.6.0-darwin-arm64.zip && rm -f electron-v37.6.0-darwin-arm64.zip`
  - Rename app bundle to match launcher expectations:
    - `mv Electron.app "Code - OSS.app"`

Outcome:
- `.build/electron/Code - OSS.app` now exists and contains Electron 37.6.0 for darwin-arm64.

### 5) Launch command used
- Skipped prelaunch to avoid re-triggering downloads:
  - `VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh`

### 6) Current state
- Desktop app launches successfully.
- The run currently relies on:
  - Manually staged Electron 37.6.0 bundle in `.build/electron/Code - OSS.app`.
  - Local dynamic-import edits in `node_modules/@vscode/gulp-electron/src/download.js` to bypass ESM/CJS interop errors.

### 7) Notes for future cleanup
- When network allows and upstream tooling aligns, consider:
  - Restoring `node_modules/@vscode/gulp-electron/src/download.js` to pristine (remove local edits) and re-running the standard `npm run electron` flow.
  - Ensuring Node version alignment per upstream `.nvmrc` / `build/npm/preinstall.js`.
  - Removing the manually staged Electron if automatic acquisition works reliably.



