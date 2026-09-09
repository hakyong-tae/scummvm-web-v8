#!/usr/bin/env bash
# 게임 원본(프리웨어) 무개조 다운로드 + sha256 검증.
#   bash tools/fetch-game.sh [lure|soltys]   (인자 없으면 lure)
# 라이선스: 각 아카이브의 LICENSE.txt / license.txt 를 배포본에 동봉해야 한다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="${1:-lure}"

case "$GAME" in
  lure)
    # Lure of the Temptress (1992, (C) Revolution Software Ltd) — freeware
    URL="https://downloads.scummvm.org/frs/extras/Lure%20of%20the%20Temptress/lure-1.1.zip"
    ZIPNAME="lure-1.1.zip"
    SHA_EXPECTED="f3178245a1483da1168c3a11e70b65d33c389f1f5df63d4f3a356886c1890108"
    SUBDIR="lure"                       # zip 안에 lure/ 폴더가 들어 있다
    CHECK=(Disk1.vga LICENSE.txt)
    ;;
  soltys)
    # Sołtys (1995, (C) Laboratorium Komputerowe Avalon) — freeware 2011, English v1.0
    URL="https://downloads.scummvm.org/frs/extras/Soltys/soltys-en-v1.0.zip"
    ZIPNAME="soltys-en-v1.0.zip"
    SHA_EXPECTED="87b89e654b8a5b8ebe342cb4c5c6049ab9a43a5efb474d9c49bafb77dcce48f6"
    SUBDIR=""                           # zip 안에 파일이 평평하게 들어 있으면 SUBDIR로 옮긴다
    CHECK=(vol.cat vol.dat license.txt)
    ;;
  *) echo "unknown game: $GAME (lure|soltys)" >&2; exit 2 ;;
esac

DEST="$ROOT/games/$GAME/data"
mkdir -p "$DEST"
ZIP="$DEST/$ZIPNAME"
if [[ ! -f "$ZIP" ]]; then
  echo "downloading $URL"
  curl -fL --retry 3 -o "$ZIP" "$URL"
fi
SHA_ACTUAL="$(shasum -a 256 "$ZIP" | cut -d' ' -f1)"
if [[ "$SHA_ACTUAL" != "$SHA_EXPECTED" ]]; then
  echo "sha256 mismatch: $SHA_ACTUAL (expected $SHA_EXPECTED)" >&2; exit 1
fi

rm -rf "$DEST/$GAME"
if [[ -n "$SUBDIR" ]]; then
  unzip -q -o "$ZIP" -d "$DEST"
else
  unzip -q -o "$ZIP" -d "$DEST/$GAME"
fi

for f in "${CHECK[@]}"; do
  test -f "$DEST/$GAME/$f" || { echo "missing $f in $DEST/$GAME" >&2; exit 1; }
done
echo "ok: $(ls "$DEST/$GAME" | wc -l | tr -d ' ') files in $DEST/$GAME"
