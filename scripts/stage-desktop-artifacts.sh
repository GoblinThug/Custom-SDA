#!/usr/bin/env bash
# Collect Tauri desktop installers for GitHub Releases (not Cargo build-script EXEs).
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

# Prefer Tauri's release/bundle tree (NSIS/MSI/DMG/deb/AppImage).
while IFS= read -r -d '' bundle; do
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    case "$base" in
      build-script-build.exe|build_script_build*.exe) continue ;;
      *.exe|*.msi|*.dmg|*.deb|*.AppImage|*.rpm|*.app.tar.gz) ;;
      *) continue ;;
    esac
    dest="$OUT/$base"
    if [[ -e "$dest" ]]; then
      # Keep unique names if the same basename appears twice.
      parent="$(basename "$(dirname "$f")")"
      dest="$OUT/${parent}-$base"
    fi
    cp -f "$f" "$dest"
  done < <(find "$bundle" -type f -print0 2>/dev/null || true)
done < <(find "${SEARCH_ROOTS[@]}" -type d -name bundle -path '*/release/bundle' -print0 2>/dev/null || true)

# Fallback: known installers under release/ (never under release/build/).
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  case "$base" in
    build-script-build.exe|build_script_build*.exe) continue ;;
    custom-sda.exe|*-setup.exe|*.msi|*.dmg|*.deb|*.AppImage) ;;
    *) continue ;;
  esac
  [[ -f "$OUT/$base" ]] || cp -f "$f" "$OUT/$base"
done < <(find "${SEARCH_ROOTS[@]}" -type f \( \
  -name 'custom-sda.exe' -o -name '*-setup.exe' -o \
  -name '*.msi' -o -name '*.dmg' -o -name '*.deb' -o -name '*.AppImage' \
\) -path '*/release/*' ! -path '*/release/build/*' -print0 2>/dev/null || true)

if [[ "$(uname -s)" == "Darwin" ]]; then
  app=$(find "${SEARCH_ROOTS[@]}" -type d -name '*.app' -path '*/release/bundle/*' -print -quit 2>/dev/null || true)
  if [[ -z "$app" ]]; then
    app=$(find "${SEARCH_ROOTS[@]}" -type d -name '*.app' -path '*/release/*' -print -quit 2>/dev/null || true)
  fi
  if [[ -n "$app" ]]; then
    ditto -c -k --sequesterRsrc --keepParent "$app" "$OUT/custom-sda-macos-app.zip"
  fi
fi

if [[ -z "$(find "$OUT" -type f -print -quit 2>/dev/null)" ]]; then
  echo "::error::No desktop installers found"
  find "${SEARCH_ROOTS[@]}" -path '*/release/bundle/*' -type f 2>/dev/null | head -100 || true
  exit 1
fi

echo "Staged artifacts:"
ls -laR "$OUT"
