#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/engine/scummvm/build-emscripten"
GAME="$ROOT/games/lure/data/lure"
test -f "$DIST/scummvm.wasm" || { echo "run npm run engine:build first" >&2; exit 1; }
test -f "$GAME/Disk1.vga"     || { echo "run npm run game:fetch first" >&2; exit 1; }
mkdir -p "$DIST/data/games/lure"
# 게임 파일(원본 그대로) — 매뉴얼/PDF는 서빙 불필요
for f in Disk1.vga Disk2.vga Disk3.vga Disk4.vga disk1.ega disk2.ega disk3.ega disk4.ega Lure.exe README LICENSE.txt; do
  cp -f "$GAME/$f" "$DIST/data/games/lure/$f"
done
python3 "$ROOT/engine/scummvm/dists/emscripten/build-make_http_index.py" "$DIST/data"
mkdir -p "$ROOT/public"
ln -sfn "../engine/scummvm/build-emscripten" "$ROOT/public/engine"
test -f "$ROOT/public/engine/data/games/lure/index.json"
echo "staged: $(ls "$DIST/data/games/lure" | wc -l | tr -d ' ') files, index.json ok"
