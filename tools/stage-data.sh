#!/usr/bin/env bash
# 게임 원본 파일 → 엔진 dist(data/games/<game>/) 복사 + HTTP FS 인덱스 생성.
#   bash tools/stage-data.sh [game ...]     (인자 없으면 games/ 아래 데이터가 있는 게임 전부)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/engine/scummvm/build-emscripten"
test -f "$DIST/scummvm.wasm" || { echo "run npm run engine:build first" >&2; exit 1; }

# 게임별 서빙 파일 목록(매뉴얼/PDF는 제외, LICENSE/README는 고지 화면에서 fetch 하므로 포함)
files_for() {
  case "$1" in
    lure)   echo "Disk1.vga Disk2.vga Disk3.vga Disk4.vga disk1.ega disk2.ega disk3.ega disk4.ega Lure.exe README LICENSE.txt" ;;
    soltys) echo "vol.cat vol.dat license.txt" ;;
    *) echo "unknown game: $1" >&2; return 1 ;;
  esac
}

GAMES=("$@")
if [[ ${#GAMES[@]} -eq 0 ]]; then
  for d in "$ROOT"/games/*/; do
    g="$(basename "$d")"
    [[ -d "$ROOT/games/$g/data/$g" ]] && GAMES+=("$g")
  done
fi
[[ ${#GAMES[@]} -gt 0 ]] || { echo "no game data staged — run npm run game:fetch <game>" >&2; exit 1; }

for g in "${GAMES[@]}"; do
  SRC="$ROOT/games/$g/data/$g"
  test -d "$SRC" || { echo "missing $SRC — run: bash tools/fetch-game.sh $g" >&2; exit 1; }
  mkdir -p "$DIST/data/games/$g"
  for f in $(files_for "$g"); do cp -f "$SRC/$f" "$DIST/data/games/$g/$f"; done
  echo "  $g: $(ls "$DIST/data/games/$g" | wc -l | tr -d ' ') files"
done

python3 "$ROOT/engine/scummvm/dists/emscripten/build-make_http_index.py" "$DIST/data"
mkdir -p "$ROOT/public"
ln -sfn "../engine/scummvm/build-emscripten" "$ROOT/public/engine"
for g in "${GAMES[@]}"; do test -f "$DIST/data/games/$g/index.json" || { echo "index.json missing for $g" >&2; exit 1; }; done
echo "staged: ${GAMES[*]} — index.json ok"
