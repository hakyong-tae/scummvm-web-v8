#!/usr/bin/env bash
# Verse8 GitLab(develop) 에 올릴 배포 폴더 `deploy/` 생성.
# - 심볼릭 링크(public/engine, public/games/lure)를 실파일로 풀고, 엔진 산출물을 트림한다(V8 빌더는 emscripten을 못 돌리므로 산출물을 커밋).
# - package.json은 V8 빌더용(bun install && bun run build → vite build). package-lock.json 없음.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy"
ENG="$ROOT/engine/scummvm/build-emscripten"
test -f "$ENG/scummvm.wasm" || { echo "run npm run engine:build && npm run data:stage first" >&2; exit 1; }
rm -rf "$OUT"; mkdir -p "$OUT/public/engine/data" "$OUT/public/games/lure" "$OUT/public/fonts" "$OUT/games/lure"

# 셸 소스
cp -R "$ROOT/src" "$OUT/src"
cp "$ROOT/index.html" "$ROOT/vite.config.ts" "$ROOT/tsconfig.json" "$ROOT/server.js" "$ROOT/NOTES.md" "$OUT/"
cp -R "$ROOT/engine-patches" "$OUT/engine-patches"      # GPLv3 소스 공개 의무(엔진 수정분)
mkdir -p "$OUT/docs"; cp "$ROOT/docs/DEPLOY-VERSE8.md" "$ROOT/docs/STORE.md" "$OUT/docs/" 2>/dev/null || true
cp "$ROOT/public/scummvm.ini" "$OUT/public/"
cp "$ROOT/public/fonts/"* "$OUT/public/fonts/"
cp "$ROOT/games/lure/"*.json "$OUT/public/games/lure/"
cp "$ROOT/games/lure/"*.json "$OUT/games/lure/"          # i18n-check 등 도구용 원본 위치

# 엔진: 필요한 것만
cp "$ENG/scummvm.js" "$ENG/scummvm.wasm" "$OUT/public/engine/"
cp "$ENG/data/lure.dat" "$ENG/data/scummmodern.zip" "$ENG/data/gui-icons/"*.dat "$OUT/public/engine/data/" 2>/dev/null || true
mkdir -p "$OUT/public/engine/data/gui-icons"; cp "$ENG/data/gui-icons/"* "$OUT/public/engine/data/gui-icons/" 2>/dev/null || true
mkdir -p "$OUT/public/engine/data/games/lure"; cp "$ENG/data/games/lure/"* "$OUT/public/engine/data/games/lure/"
rm -f "$OUT/public/engine/data/games/lure/index.json"
python3 "$ROOT/engine/scummvm/dists/emscripten/build-make_http_index.py" "$OUT/public/engine/data"

# V8 빌더용 package.json (emscripten 관련 스크립트 제거)
python3 - "$ROOT/package.json" "$OUT/package.json" <<'PY'
import json,sys
src=json.load(open(sys.argv[1]))
out={"name":src["name"],"version":src["version"],"private":True,"type":"module","description":src["description"],"license":src["license"],
 "scripts":{"dev":"vite","build":"vite build","preview":"vite preview","test":"vitest run","i18n:check":"node tools/i18n-check.mjs"},
 "dependencies":src.get("dependencies",{}),"devDependencies":src["devDependencies"]}
json.dump(out,open(sys.argv[2],'w'),indent=2,ensure_ascii=False); open(sys.argv[2],'a').write('\n')
PY
mkdir -p "$OUT/tools" "$OUT/tests"; cp "$ROOT/tools/i18n-check.mjs" "$OUT/tools/"; cp "$ROOT/tests/"*.test.ts "$OUT/tests/"
printf 'node_modules/\ndist/\npackage-lock.json\n.DS_Store\n*.log\n' > "$OUT/.gitignore"
echo "deploy/ ready: $(du -sh "$OUT" | cut -f1) (engine $(du -sh "$OUT/public/engine" | cut -f1))"
find "$OUT" -type l | head -3 | sed 's/^/WARNING symlink: /' || true
