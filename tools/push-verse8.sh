#!/usr/bin/env bash
# deploy/<game>/ 를 그 게임의 Verse8 GitLab develop 에 올린다.
#   bash tools/push-verse8.sh <glpat-토큰> [game] [커밋 메시지]      (game 생략 시 lure)
# 안전장치: 임시 디렉터리에서만 작업하고, 클론이 실패하면 즉시 중단한다(개발 레포를 절대 건드리지 않음).
set -euo pipefail
TOKEN="${1:?토큰 필요}"; GAME="${2:-lure}"; MSG="${3:-deploy: $(date +%Y-%m-%d)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
case "$GAME" in
  lure)   REPO="gitlab.verse8.io/hy.tae90/lure-of-the-temptress-kr.git" ;;
  soltys) REPO="${SOLTYS_REPO:?soltys는 V8 프로젝트를 먼저 만들고 SOLTYS_REPO=gitlab.verse8.io/<네임스페이스>/<프로젝트>.git 로 지정}" ;;
  *) echo "unknown game: $GAME" >&2; exit 2 ;;
esac
SRC="$ROOT/deploy/$GAME"
test -f "$SRC/public/engine/scummvm.wasm" || { echo "$SRC 없음 — bash tools/prepare-deploy.sh $GAME 먼저" >&2; exit 1; }
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
if ! git clone -q -b develop "https://oauth2:${TOKEN}@${REPO}" "$WORK/repo" 2> "$WORK/clone.err"; then
  sed 's/glpat-[A-Za-z0-9_-]*/***/g' "$WORK/clone.err" >&2; echo "클론 실패 — 토큰 만료/회수 가능성. Verse8 Git Access에서 토큰 재발급." >&2; exit 2
fi
cd "$WORK/repo"
# 플랫폼이 관리하는 파일은 남긴다(.env / .agent8.lock / committedAt / PROJECT / .gitignore)
find . -mindepth 1 -maxdepth 1 ! -name .git ! -name .env ! -name .agent8.lock ! -name committedAt ! -name .gitignore ! -name PROJECT -exec rm -rf {} +
cp -R "$SRC/." .
rm -rf node_modules dist package-lock.json
grep -q "package-lock.json" .gitignore || printf '\n# scummvm-web-v8\ndist/\npackage-lock.json\n.DS_Store\n' >> .gitignore
test -f .env && test -f server/src/server.ts && test -f public/engine/scummvm.wasm
git add -A
if git diff --cached --quiet; then echo "변경 없음 — push 생략"; exit 0; fi
git commit -qm "$MSG"
git push -q origin develop 2>&1 | sed 's/glpat-[A-Za-z0-9_-]*/***/g' | grep -v '^remote:' || true
echo "pushed $GAME → develop $(git rev-parse --short HEAD)"
