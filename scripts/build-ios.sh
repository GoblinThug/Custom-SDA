#!/usr/bin/env bash
# Release / simulator iOS build (macOS + Xcode only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: iOS builds require macOS with Xcode (tauri ios is unavailable on Windows/Linux)." >&2
  echo "See scripts/setup-ios.md or trigger .github/workflows/build-release.yml on GitHub." >&2
  exit 1
fi

export CI="${CI:-true}"

if [[ ! -d "$ROOT/src-tauri/gen/apple" ]]; then
  echo "Initializing iOS project (src-tauri/gen/apple)…"
  npm run tauri ios init -- --ci
fi

if [[ -f "$ROOT/src-tauri/gen/apple/Podfile" ]]; then
  echo "Installing CocoaPods…"
  (cd "$ROOT/src-tauri/gen/apple" && pod install)
fi

EXTRA_ARGS=()
if [[ $# -eq 0 ]]; then
  EXTRA_ARGS=(--target aarch64-sim)
fi

echo "Building iOS (${EXTRA_ARGS[*]:-${*}})…"
npm run tauri ios build -- "${EXTRA_ARGS[@]:-$@}"

mkdir -p "$ROOT/release"
echo "Check src-tauri/gen/apple for .app / .ipa output (paths vary by target and signing)."
