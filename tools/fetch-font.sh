#!/usr/bin/env bash
# Neo둥근모 v1.601 — SIL Open Font License 1.1 (RFN "Neo둥근모"; 이름 변경 없이 사용)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/public/fonts"
curl -fL --retry 3 -o "$ROOT/public/fonts/neodgm.woff2" "https://github.com/neodgm/neodgm/releases/download/v1.601/neodgm.woff2"
curl -fL --retry 3 -o "$ROOT/public/fonts/LICENSE-neodgm.txt" "https://raw.githubusercontent.com/neodgm/neodgm/main/LICENSE.txt"
head -1 "$ROOT/public/fonts/LICENSE-neodgm.txt" | grep -q "Eunbin Jeong" && echo "font ok ($(stat -f%z "$ROOT/public/fonts/neodgm.woff2") bytes)"
