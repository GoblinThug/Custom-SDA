#!/usr/bin/env bash
# Collect Tauri desktop installers/binaries for CI (root target/, triple dirs, src-tauri/target/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/release-artifacts"
rm -rf "$OUT"
mkdir -p "$OUT"

SEARCH_ROOTS=()
[[ -d "$ROOT/target" ]] && SEARCH_ROOTS+=("$ROOT/target")
[[ -d "$ROOT/src-tauri/target" ]] && SEARCH_ROOTS+=("$ROOT/src-tauri/target")

if ((${#SEARCH_ROOTS[@]} == 0)); then
  echo "::error::No Cargo target directory found"
  exit 1
fi

# Any */release/bundle or */aarch64-apple-darwin/release/bundle
while IFS= read -r -d '' bundle; do
  cp -R "$bundle/." "$OUT/"
done < <(find "${SEARCH_ROOTS[@]}" -type d -name bundle -path '*/release/bundle' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp "$f" "$OUT/"
done < <(find "${SEARCH_ROOTS[@]}" -type f \( \
  -name 'custom-sda' -o -name 'custom-sda.exe' -o -name '*.exe' -o \
  -name '*.msi' -o -name '*.dmg' -o -name '*.deb' -o -name '*.AppImage' \
\) -path '*/release/*' -print0 2>/dev/null || true)

while IFS= read -r -d '' app; do
  name=$(basename "$app")
  if [[ ! -e "$OUT/$name" ]]; then
    cp -R "$app" "$OUT/"
  fi
done < <(find "${SEARCH_ROOTS[@]}" -type d -name '*.app' -print0 2>/dev/null || true)

# macOS: zip .app so upload-artifact always has a top-level file (CI-friendly download).
if [[ "$(uname -s)" == "Darwin" ]]; then
  app=$(find "$OUT" -maxdepth 4 -type d -name '*.app' -print -quit)
  if [[ -z "$app" ]]; then
    app=$(find "${SEARCH_ROOTS[@]}" -type d -name '*.app' -print -quit)
    [[ -n "$app" ]] && cp -R "$app" "$OUT/"
  fi
  app=$(find "$OUT" -maxdepth 4 -type d -name '*.app' -print -quit)
  if [[ -n "$app" ]]; then
    ditto -c -k --sequesterRsrc --keepParent "$app" "$OUT/custom-sda-macos-app.zip"
  fi
fi

if [[ -z "$(find "$OUT" -mindepth 1 -print -quit)" ]]; then
  echo "::error::No desktop artifacts found"
  find "${SEARCH_ROOTS[@]}" -path '*/release/*' \( -type f -o -type d \) 2>/dev/null | head -100 || true
  exit 1
fi

echo "Staged artifacts:"
ls -laR "$OUT"
