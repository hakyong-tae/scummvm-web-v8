# Verse8 배포 절차 — Lure of the Temptress (한글판)

## 0. 전제
- Verse8 빌더는 `bun install && bun run build`만 돌린다 → **Emscripten 산출물(scummvm.js/wasm, data/)을 실파일로 커밋**해야 한다. 그래서 개발 레포(심볼릭 링크)와 배포 폴더(`deploy/`, 실파일)를 분리한다.
- 배포 브랜치는 **`develop`**. `package-lock.json` 금지(bun). 플랫폼이 넣어둔 `.env`(`VITE_AGENT8_*`)·`.agent8.lock`은 보존.
- 하위경로 호스팅 → 절대경로 금지(`assetUrl()`), `base:'./'`, `GAME_SIZE_RESPONSE` 핸드셰이크(이미 index.html에 있음).

## 1. 배포 폴더 만들기
    npm run engine:build && npm run data:stage      # 엔진이 최신인지
    npm run i18n:check && npm test
    bash tools/prepare-deploy.sh                    # → deploy/ (약 20MB)
    cd deploy && npm install --legacy-peer-deps && npm run build && cd ..
    node tools/serve-subpath.mjs &                  # http://localhost:3047/g/lure/
    node tools/smoke.mjs --lang=ko http://localhost:3047/g/lure/   # SMOKE OK 이어야 함

## 2. GitLab에 올리기 (토큰은 verse8.io 채팅 ⋯ → Git Access → Generate Token, 1회만 표시)
    git clone -b develop https://oauth2:<TOKEN>@gitlab.verse8.io/<user>/<repo>.git v8repo
    cd v8repo
    # 플랫폼 파일 보존: .env .agent8.lock committedAt 는 남기고 나머지 템플릿 삭제
    find . -mindepth 1 -maxdepth 1 ! -name .git ! -name .env ! -name .agent8.lock ! -name committedAt -exec rm -rf {} +
    cp -R ../deploy/. .
    rm -f package-lock.json
    git add -A && git commit -m "Lure of the Temptress (한글판) — ScummVM Emscripten + DOM 한글 자막 레이어" && git push origin develop

## 3. V8 AI에게 붙여넣을 프롬프트 (외부 push는 자동 반영되지 않음)
    코드나 파일을 생성/수정하지 마. 아래 셸 명령만 순서대로 실행해줘:
    git fetch origin
    git reset --hard origin/develop
    bun install
    bun run build
빌드 후 "게시 준비 완료"에서 멈추면 **게시(Publish)** 를 명시적으로 요구한다.

## 4. 배포 후 확인
- 프리뷰에서 시작 → 인터스티셜(실광고) → 첫 방 한글 표시
- 폰: 드래그 커서·롱프레스 팝업, 세로 화면 안내
- 세이브: F5 → 저장 → 다른 기기/브라우저에서 접속 → "저장: 클라우드" 배지 → 불러오기에 슬롯 표시
- 콘솔에 `[v8] connect failed` 없음, `bundle`에 `"@agent8/gameserver"` 문자열 0건(`grep -c` on dist/assets/*.js)

## 5. 라이선스 체크리스트
- `public/engine/data/games/lure/LICENSE.txt`·`README` 동봉(1조) · 게임 유료화/유료 해금 없음(3조) · 고지 화면에 "비공식 한글 자막, 원본 무개조"(4조) · `engine-patches/` 동봉(GPLv3)
