## Newma Dev Runbook (macOS/Linux/Windows)

This runbook documents the minimal, stable setup to build and run the Newma dev app (VS Code rename) reliably, plus fixes for common pitfalls we encountered.

### Prerequisites
- Node.js: use Node 20 LTS. Verified with v20.19.5.
  - On macOS (Homebrew): `/opt/homebrew/opt/node@20/bin/node --version` should print v20.x.
  - Temporarily prepend Node 20 to PATH when running scripts:

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
```

- npm: use the npm that ships with Node 20 (no yarn).
- Git submodules: not required for dev run in this setup.

### Install and Build
From the repo root:

```bash
# Ensure Node 20 is first on PATH
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

npm ci
npm run compile
```

Notes:
- If you see missing build deps (e.g., ternary-stream, gulp-sort), run `npm ci` at repo root and re-run `npm run compile`.
- If `out/nls.messages.json` is missing at runtime, a full `npm run compile` generates it.

### Launch (Dev)

Preferred (uses preLaunch: downloads Electron if needed, syncs built-ins, and starts dev):

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
./scripts/code.sh
```

Direct (explicit two-step):

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
node build/lib/preLaunch.js
"./.build/electron/Newma.app/Contents/MacOS/Electron" . --disable-extension=vscode.vscode-api-tests
```

Verification:

```bash
ps aux | grep -i "Newma.app/Contents/MacOS/Electron" | grep -v grep
```

### Product and Branding

- `product.json`: contains `nameLong`, `applicationName`, `darwinBundleIdentifier`, etc.
- macOS icon resource: `resources/darwin/newma.icns`
- Bundling config: `build/lib/electron.ts`
  - Ensure:

```startLine:endLine:build/lib/electron.ts
export const config = {
    // ...
    darwinIcon: 'resources/darwin/newma.icns',
    darwinBundleIdentifier: product.darwinBundleIdentifier,
    // ...
};
```

### macOS App Icon shows Electron instead of Newma

Cause: macOS icon cache and/or incomplete icon keys in `Info.plist`.

Fix (post-bundle) — update `Info.plist` inside the built app and refresh caches:

```bash
APP="/Users/<you>/VSCODE/vscode/.build/electron/Newma.app"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile Newma.icns" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Delete :CFBundleIcons" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleIconName string Newma" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIcons dict" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIcons:CFBundlePrimaryIcon dict" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIcons:CFBundlePrimaryIcon:CFBundleIconFiles array" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIcons:CFBundlePrimaryIcon:CFBundleIconFiles:0 string Newma" "$APP/Contents/Info.plist"

touch "$APP" "$APP/Contents/Info.plist"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user
rm -rf ~/Library/Caches/com.apple.iconservices.store ~/Library/Caches/com.apple.iconservices* 2>/dev/null || true
killall Dock 2>/dev/null || true
killall Finder 2>/dev/null || true
```

If Dock/Finder restart is blocked by SIP, log out/in or reboot.

To make this permanent across rebuilds, keep `darwinIcon` set in `build/lib/electron.ts` and avoid overwriting `resources/darwin/newma.icns`.

### Common Errors and Root-Cause Fixes

- TypeError: Cannot read properties of undefined (reading 'exports') at cjsPreparseModuleExports
  - Root cause: Node 22 ESM/CJS translator strictness. Fix: use Node 20 LTS (v20.19.5 verified). Ensure PATH points to Node 20 when running `npm run compile` and `./scripts/code.sh`.

- ERR_INVALID_ARG_TYPE with `promisify(require('glob'))` in `build/gulpfile.vscode.js`
  - Use a version-agnostic import (glob v7 vs v9+) if needed. Our environment works with Node 20 and current deps.

- EPERM writing `~/.vscode-oss-dev/extensions/control.json`
  - Caused by home dir ACL/xattr. Workaround: write control under workspace, or fix folder permissions. Our current runs no longer hit EPERM.

- ENOENT: `out/nls.messages.json`
  - Run `npm run compile` to generate localization assets.

- Electron download timeout
  - Optionally set `ELECTRON_MIRROR` if your network requires a mirror.

### Linux and Windows Icon Notes

- Linux: provide PNGs under `resources/linux` and ensure packaging pipeline references them.
- Windows: `resources/win32/newma.ico` and packaging config should point to it. For dev, macOS runs are most visible; release packaging will embed platform icons.

### Quick Checklist

1) Node 20 on PATH
2) `npm ci`
3) `npm run compile`
4) Launch via `./scripts/code.sh` (PATH still set)
5) If Dock shows Electron icon: apply Info.plist icon keys + refresh caches

### Useful Commands

```bash
# Verify processes
ps aux | grep -i "Newma.app/Contents/MacOS/Electron" | grep -v grep

# Force-prelaunch (downloads Electron, syncs built-ins)
node build/lib/preLaunch.js

# Direct-launch main
"./.build/electron/Newma.app/Contents/MacOS/Electron" . --disable-extension=vscode.vscode-api-tests
```




