#!/usr/bin/env bash
# Verse8 GitLab(develop) 에 올릴 배포 폴더 `deploy/<game>/` 생성.
#   bash tools/prepare-deploy.sh [game]        (인자 없으면 lure)
# - 심볼릭 링크(public/engine, public/games/<game>)를 실파일로 풀고, 엔진 산출물을 트림한다
#   (V8 빌더는 emscripten을 못 돌리므로 산출물을 커밋해야 한다).
# - 게임 하나만 담는다: 다른 게임의 엔진 데이터·번역·힌트는 넣지 않는다.
# - package.json은 V8 빌더용(bun install && bun run build → vite build). package-lock.json 없음.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="${1:-lure}"
OUT="$ROOT/deploy/$GAME"
ENG="$ROOT/engine/scummvm/build-emscripten"
test -f "$ENG/scummvm.wasm" || { echo "run npm run engine:build && npm run data:stage first" >&2; exit 1; }
test -d "$ENG/data/games/$GAME" || { echo "no staged data for '$GAME' — run: bash tools/stage-data.sh $GAME" >&2; exit 1; }
test -f "$ROOT/server/src/server.ts"

# 게임별 엔진 데이터 파일(engine dist 의 data/ 에서 이 게임이 필요로 하는 것)
case "$GAME" in
  lure)   ENGINE_DATA=(lure.dat) ; COLLECTION="lure_saves" ;;
  soltys) ENGINE_DATA=()         ; COLLECTION="soltys_saves" ;;   # cge 는 별도 .dat 없음
  *) echo "unknown game: $GAME" >&2; exit 2 ;;
esac

rm -rf "$OUT"; mkdir -p "$OUT/public/engine/data" "$OUT/public/games/$GAME" "$OUT/public/fonts" "$OUT/games/$GAME"

# 셸 소스
cp -R "$ROOT/src" "$OUT/src"
cp "$ROOT/index.html" "$ROOT/vite.config.ts" "$ROOT/tsconfig.json" "$ROOT/NOTES.md" "$OUT/"
cp -R "$ROOT/server" "$OUT/server"                       # agent8 서버 함수(server/src/server.ts)
cp -R "$ROOT/engine-patches" "$OUT/engine-patches"       # GPLv3 소스 공개 의무(엔진 수정분)
mkdir -p "$OUT/docs"; cp "$ROOT/docs/DEPLOY-VERSE8.md" "$OUT/docs/" 2>/dev/null || true
cp "$ROOT/docs/store/$GAME.md" "$ROOT/docs/store/$GAME-short.md" "$OUT/docs/" 2>/dev/null || true
cp "$ROOT/public/scummvm.ini" "$OUT/public/"
cp "$ROOT/public/fonts/"* "$OUT/public/fonts/"
cp "$ROOT/games/$GAME/"*.json "$OUT/public/games/$GAME/"
cp "$ROOT/games/$GAME/"*.json "$OUT/games/$GAME/"        # i18n-check 등 도구용 원본 위치

# 이 배포본이 어떤 게임인지 고정(?game= 없이 열어도 맞는 게임이 뜨도록).
# meta 태그가 주(主)다 — V8 빌더가 production 모드로 돌지 않으면 .env.production 은 적용되지 않는다(26-09-09 실측).
python3 - "$OUT/index.html" "$GAME" <<'PYMETA'
import sys, io, re
p, game = sys.argv[1], sys.argv[2]
s = io.open(p, encoding='utf-8').read()
s2, n = re.subn(r'<meta name="svm-game" content="[^"]*">', '<meta name="svm-game" content="%s">' % game, s, count=1)
assert n == 1, 'index.html 에 <meta name="svm-game"> 이 없다'   # 같은 값으로 바꿔도(s2==s) 통과해야 한다
io.open(p, 'w', encoding='utf-8').write(s2)
PYMETA
printf 'VITE_GAME=%s\n' "$GAME" > "$OUT/.env.production"   # 보조(빌드가 production 모드일 때만 먹는다)

# 클라우드 세이브 컬렉션을 게임별로 — 게임마다 V8 프로젝트(DB)가 따로지만 이름이 섞이면 헷갈린다.
# ⚠️ 이미 배포된 게임의 이름을 바꾸면 기존 클라우드 세이브가 끊긴다(lure 는 lure_saves 유지).
python3 - "$OUT/server/src/server.ts" "$COLLECTION" <<'PY'
import re,sys,io
p,coll=sys.argv[1],sys.argv[2]
s=io.open(p,encoding='utf-8').read()
s2=re.sub(r'const SAVES = "[^"]*";', 'const SAVES = "%s";' % coll, s, count=1)
assert s2!=s or ('"%s"'%coll) in s, 'SAVES 상수를 찾지 못했다'
io.open(p,'w',encoding='utf-8').write(s2)
PY

# 엔진: 이 게임에 필요한 것만
cp "$ENG/scummvm.js" "$ENG/scummvm.wasm" "$OUT/public/engine/"
for f in "${ENGINE_DATA[@]:-}"; do [[ -n "$f" ]] && cp "$ENG/data/$f" "$OUT/public/engine/data/"; done
cp "$ENG/data/scummmodern.zip" "$OUT/public/engine/data/" 2>/dev/null || true
mkdir -p "$OUT/public/engine/data/gui-icons"; cp "$ENG/data/gui-icons/"* "$OUT/public/engine/data/gui-icons/" 2>/dev/null || true
mkdir -p "$OUT/public/engine/data/games/$GAME"; cp "$ENG/data/games/$GAME/"* "$OUT/public/engine/data/games/$GAME/"
rm -f "$OUT/public/engine/data/games/$GAME/index.json"
python3 "$ROOT/engine/scummvm/dists/emscripten/build-make_http_index.py" "$OUT/public/engine/data"

# V8 빌더용 package.json (emscripten 관련 스크립트 제거)
python3 - "$ROOT/package.json" "$OUT/package.json" "$GAME" <<'PY'
import json,sys
src=json.load(open(sys.argv[1])); game=sys.argv[3]
out={"name":src["name"]+"-"+game,"version":src["version"],"private":True,"type":"module","description":src["description"],"license":src["license"],
 "scripts":{"dev":"vite","build":"vite build","preview":"vite preview","test":"vitest run","i18n:check":"node tools/i18n-check.mjs --game="+game},
 "dependencies":src.get("dependencies",{}),"devDependencies":src["devDependencies"]}
json.dump(out,open(sys.argv[2],'w'),indent=2,ensure_ascii=False); open(sys.argv[2],'a').write('\n')
PY
mkdir -p "$OUT/tools" "$OUT/tests"; cp "$ROOT/tools/i18n-check.mjs" "$OUT/tools/"; cp "$ROOT/tests/"*.test.ts "$OUT/tests/"
printf 'node_modules/\ndist/\npackage-lock.json\n.DS_Store\n*.log\n' > "$OUT/.gitignore"
echo "deploy/$GAME ready: $(du -sh "$OUT" | cut -f1) (engine $(du -sh "$OUT/public/engine" | cut -f1)), saves=$COLLECTION"
find "$OUT" -type l | head -3 | sed 's/^/WARNING symlink: /' || true
