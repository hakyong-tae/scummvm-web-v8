#!/usr/bin/env bash
# ScummVM v2026.3.0 → wasm. 산출물: engine/scummvm/build-emscripten/
# 엔진 선택: ENGINES=lure,cge (기본). 목록이 바뀌면 자동으로 재configure 한다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/engine/scummvm"
TAG="v2026.3.0"
EMSDK_DIR="${EMSDK_DIR:-$HOME/Downloads/emsdk}"
JOBS="$(sysctl -n hw.ncpu 2>/dev/null || echo 4)"
ENGINES="${ENGINES:-lure,cge}"

if [[ ! -d "$SRC/.git" ]]; then
  mkdir -p "$ROOT/engine"
  git clone --depth 1 --branch "$TAG" https://github.com/scummvm/scummvm.git "$SRC"
fi

cd "$SRC"
# 소스 트리만 리셋(빌드 산출물 .o/build-emscripten 은 루트에 남겨 증분 빌드 유지)
git checkout -- .
git clean -fdq -- engines backends dists
for p in "$ROOT"/engine-patches/*.patch; do
  echo "apply $(basename "$p")"; git apply "$p"
done

# shellcheck disable=SC1091
source "$EMSDK_DIR/emsdk_env.sh" >/dev/null
export EMSDK_PYTHON="${EMSDK_PYTHON:-python3}"

# 엔진 목록이 지난 빌드와 다르면 재configure(엔진을 추가해도 config.mk가 그대로면 반영 안 됨)
STAMP=".engines-stamp"
if [[ ! -f config.mk || ! -f "$STAMP" || "$(cat "$STAMP")" != "$ENGINES" || "${RECONFIGURE:-0}" == "1" ]]; then
  echo "configure with engines: $ENGINES"
  emconfigure ./configure \
    --host=wasm32-unknown-emscripten --build=wasm32-unknown-emscripten \
    --disable-all-engines --enable-engine="$ENGINES" \
    --disable-mt32emu --disable-fluidsynth \
    --enable-release
  rm -f scummvm-conf.*
  echo "$ENGINES" > "$STAMP"
fi

emmake make -j "$JOBS"
emmake make dist-emscripten
ls -la build-emscripten/scummvm.js build-emscripten/scummvm.wasm build-emscripten/data/*.dat
