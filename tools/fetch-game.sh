#!/usr/bin/env bash
# Lure of the Temptress (freeware, (C) Revolution Software Ltd) — 원본 무개조 다운로드.
# 라이선스: games/lure/data/lure/LICENSE.txt (배포 시 README/LICENSE.txt 동봉 의무)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/games/lure/data"
URL="https://downloads.scummvm.org/frs/extras/Lure%20of%20the%20Temptress/lure-1.1.zip"
SHA_EXPECTED="f3178245a1483da1168c3a11e70b65d33c389f1f5df63d4f3a356886c1890108"
mkdir -p "$DEST"
ZIP="$DEST/lure-1.1.zip"
if [[ ! -f "$ZIP" ]]; then
  echo "downloading $URL"
  curl -fL --retry 3 -o "$ZIP" "$URL"
fi
SHA_ACTUAL="$(shasum -a 256 "$ZIP" | cut -d' ' -f1)"
if [[ "$SHA_ACTUAL" != "$SHA_EXPECTED" ]]; then
  echo "sha256 mismatch: $SHA_ACTUAL" >&2; exit 1
fi
rm -rf "$DEST/lure"
unzip -q "$ZIP" -d "$DEST"
test -f "$DEST/lure/Disk1.vga" && test -f "$DEST/lure/LICENSE.txt"
echo "ok: $(ls "$DEST/lure" | wc -l | tr -d ' ') files in $DEST/lure"
