# Verse8 배포 절차 (게임별)

이 레포는 게임 여러 개를 담는 셸이고, **배포는 게임마다 따로** 한다(V8 프로젝트/레포도 게임마다 하나).
아래 `<game>` = `lure` | `soltys`.

## 0. 전제
- Verse8 빌더는 `bun install && bun run build`만 돌린다 → **Emscripten 산출물(scummvm.js/wasm, data/)을 실파일로 커밋**해야 한다.
  그래서 개발 레포(심볼릭 링크)와 배포 폴더(`deploy/<game>/`, 실파일)를 분리한다.
- 배포 브랜치는 **`develop`**. `package-lock.json` 금지(bun). 플랫폼이 넣어둔 `.env`(`VITE_AGENT8_*`)·`.agent8.lock`은 보존.
- 하위경로 호스팅 → 절대경로 금지(`assetUrl()`), `base:'./'`, `GAME_SIZE_RESPONSE` 핸드셰이크(이미 index.html에 있음).
- 배포본은 **`.env.production`에 `VITE_GAME=<game>`** 을 담으므로 `?game=` 없이 열어도 맞는 게임이 뜬다.
- 게임은 `--path=/data/games/<game> <target>` 인자로 띄운다 → `scummvm.ini`에 게임 섹션이 필요 없다
  (같은 오리진에서 IDBFS에 캐시된 낡은 ini 때문에 새 게임이 안 뜨는 사고를 원천 차단).

## 1. 배포 폴더 만들기
    npm run engine:build && npm run data:stage            # 엔진이 최신인지 (ENGINES=lure,cge)
    npm run i18n:check -- --game=<game> && npm test
    npm run deploy:prepare -- <game>                      # → deploy/<game>/  (lure 17MB · soltys 19MB)
    cd deploy/<game> && npm install --legacy-peer-deps && npm run build && cd ../..
    npm run deploy:serve -- <game> &                      # http://localhost:3057/g/<game>/
    node tools/smoke-boot.mjs --game=<game> --lang=ko --secs=45 \
      --steps="key:Escape;key:Escape;wait:6;move:251,105" http://localhost:3057/g/<game>/
    # lure 는 전용 스모크도 있다: node tools/smoke.mjs --lang=ko http://localhost:3057/g/lure/

`prepare-deploy.sh`가 게임별로 처리하는 것:
- 그 게임의 엔진 데이터·번역·힌트만 담는다(다른 게임 것은 넣지 않는다)
- `server/src/server.ts`의 클라우드 세이브 컬렉션명을 게임별로 치환
  (**이미 배포된 게임의 이름은 바꾸지 말 것** — 기존 클라우드 세이브가 끊긴다. lure = `lure_saves`)
- `docs/store/<game>{,-short}.md` 를 배포본 `docs/`에 동봉

## 2. GitLab에 올리기 (토큰은 verse8.io 채팅 ⋯ → Git Access → Generate Token, 1회만 표시)

    bash tools/push-verse8.sh <glpat-토큰> <game> "커밋 메시지"    # 임시 디렉터리에서만 작업, 클론 실패 시 즉시 중단

`soltys`는 V8 프로젝트를 먼저 만든 뒤 레포 주소를 넘긴다:

    SOLTYS_REPO=gitlab.verse8.io/<네임스페이스>/<프로젝트>.git bash tools/push-verse8.sh <토큰> soltys "…"

수동으로 할 경우:
    git clone -b develop https://oauth2:<TOKEN>@gitlab.verse8.io/<user>/<repo>.git v8repo
    cd v8repo
    # 플랫폼 파일 보존: .env .agent8.lock committedAt PROJECT 는 남기고 나머지 템플릿 삭제
    find . -mindepth 1 -maxdepth 1 ! -name .git ! -name .env ! -name .agent8.lock ! -name committedAt ! -name PROJECT -exec rm -rf {} +
    cp -R ../deploy/<game>/. .
    rm -f package-lock.json
    git add -A && git commit -m "…" && git push origin develop

## 3. V8 AI에게 붙여넣을 프롬프트 (외부 push는 자동 반영되지 않음)
    코드나 파일을 생성/수정하지 마. 아래 셸 명령만 순서대로 실행해줘:
    git fetch origin
    git reset --hard origin/develop
    bun install
    bun run build
빌드 후 "게시 준비 완료"에서 멈추면 **게시(Publish)** 를 명시적으로 요구한다.

## 4. 배포 후 확인
- 프리뷰에서 시작 → 인터스티셜(실광고) → 첫 화면 한글 표시
- 폰: 조작(게임별로 다름 — lure는 롱프레스 동작 메뉴, soltys는 탭=걷기/롱프레스=사용), 세로 화면 안내
- 세이브: 저장 → 다른 기기/브라우저에서 접속 → "저장: 클라우드" 배지 → 불러오기에 슬롯 표시
- 콘솔에 `[v8] connect failed` 없음, 번들에 `"@agent8/gameserver"` 문자열 0건(`grep -c` on `dist/assets/*.js`)

## 5. 라이선스 체크리스트
- 원본 라이선스 파일 동봉(1조) — lure `LICENSE.txt`+`README`, soltys `license.txt` (`public/engine/data/games/<game>/`)
- 게임 유료화/유료 해금 없음(3조) — 광고는 게임 요금이 아니며 힌트는 자발적 시청
- 고지 화면에 "비공식 한글 자막, 원본 무개조"(4조)
- `engine-patches/` 동봉(GPLv3) — lure는 패치 01, soltys는 패치 06이 엔진 수정분
