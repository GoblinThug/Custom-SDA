#!/usr/bin/env bash
# CocoaPods for Tauri iOS — skip when empty; drop macOS Podfile target if the Xcode project is iOS-only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPLE="$ROOT/src-tauri/gen/apple"
cd "$APPLE"

if [[ ! -f Podfile ]]; then
  echo "No Podfile — skip"
  exit 0
fi

if ! grep -qE "^[[:space:]]*pod[[:space:]]+['\"]" Podfile; then
  echo "No pod dependencies in Podfile — skip pod install"
  exit 0
fi

PROJ=( *.xcodeproj )
if [[ ! -e "${PROJ[0]}" ]]; then
  echo "No .xcodeproj — skip"
  exit 0
fi

TARGETS=$(xcodebuild -list -project "${PROJ[0]}" 2>/dev/null | sed -n '/Targets:/,/Schemes:/p' | tail -n +2 | sed '/^$/q' | xargs || true)

if grep -q "custom-sda_macOS" Podfile && ! echo "$TARGETS" | grep -qw "custom-sda_macOS"; then
  echo "Stripping custom-sda_macOS from Podfile (not in Xcode project)"
  python3 - "$APPLE/Podfile" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text()
text = re.sub(
    r"\n?target 'custom-sda_macOS' do.*?^end\n",
    "\n",
    text,
    count=1,
    flags=re.M | re.S,
)
path.write_text(text)
PY
fi

pod install --project-directory=.
