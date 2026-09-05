# scummvm-web-v8 — Lure of the Temptress 웹판 구조 노트

## 개요
- 게임: Lure of the Temptress (1992, Revolution Software) — 프리웨어. 라이선스 `games/lure/data/lure/LICENSE.txt` 6조
  (무료배포 OK · 상업배포물 포함 OK · **게임 유료화 금지** · 개조 시 명시). 원본 zip 무개조(sha256 고정).
- 엔진: ScummVM v2026.3.0, lure 엔진만 Emscripten(emsdk 6.0.0, `~/Downloads/emsdk`) 빌드. GPLv3 → `engine-patches/` 전체 공개.
- 한글: 엔진 내 CJK 불가(8×8 단일바이트 폰트) → DOM 텍스트 레이어. **M2 = 영문 패스스루 완료**, M3 = 한글(별도 플랜).
- 설계 스펙: `docs/superpowers/specs/2026-09-06-lure-korean-web-design.md`, 플랜: `docs/superpowers/plans/`.

## 실행
    export PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH"
    npm install && npm run game:fetch && npm run font:fetch
    npm run engine:build      # 클론(v2026.3.0)→패치→configure→make→dist. M1 Mac 기준 2~3분 (pkg-config 필요: brew install pkgconf)
    npm run data:stage        # 게임 파일 → dist data/games/lure + index.json, public/engine 심볼릭 링크
    npm run dev               # http://localhost:3046  (launch.json: scummvm-web-v8)
    npm test                  # vitest 9
    node tools/smoke.mjs      # 헤드리스 스모크(부팅→인트로 스킵→동사 팝업→대화창→닫기, 스크린샷 docs/superpowers/plans/shots/)

## 파일 구조 / 데이터 흐름
- `public/engine -> engine/scummvm/build-emscripten` : scummvm.js/wasm + data/(lure.dat, 테마, games/lure/)
- ScummVM HTTP FS: `DATA_PATH=/data` 절대경로 → 패치 03이 `Module.httpFsBaseUrl`(= engine/ URL) 접두 → 하위경로 호스팅(V8) 대응.
  같은 패치에 `response.bytes()` 폴백(Chrome 133+/Safari 18.4+ 전용 API → 구형 브라우저는 arrayBuffer).
- `public/scummvm.ini` : IDBFS(`/home/web_user`)에 없을 때 1회 fetch. `savepath=/home/web_user/saves`, `aspect_ratio=false`, `stretch_mode=fit`
  → 캔버스 CSS 박스 = 320×200 선형 매핑(레이어 좌표는 `getBoundingClientRect()/320`).
- 텍스트 파이프라인(패치 01, `engines/lure/webtext.{h,cpp}`):
  `Surface::writeSubstring` → `WebText::record`(표면 로컬 좌표, 글자색·배경 팔레트 인덱스, 폭px)
  → `Surface::copyTo` → `WebText::transfer`(표면 간 이동)
  → 화면 싱크(`Screen::update/updateArea`, `Surface::copyToScreen/centerOnScreen`) → `WebText::present` → `Module.onLureText(json)`
  → `parseRecords` → `TextLayer.render` (diff → span, 배경색 박스로 엔진 글리프 덮음).
  `StringData::getString` 끝에서 `Module.onLureString(stringId, 영문)` (M3 번역 lookup용).
- 레코드 교체 규칙: **같은 줄(|Δy|<4)이고 x가 겹칠 때만** 교체. 대화창이 squashedLines(7px 피치, 8px 글리프)라 인접 줄이 1px 겹치기 때문.
- 사라진 텍스트 판정: 싱크 시점에 레코드 박스 안에 글자색 픽셀이 4개 미만이면 제거(엔진이 덮어그린 것으로 간주).
- JSON 색은 팔레트 인덱스 → RGB 변환해 전달(`Screen::getReference().getPalette()` 4바이트/엔트리).

## 검증 결과 (2026-09-06)
- M1: Chrome(가시 탭)에서 rAF 120/s, longtask 0 → Asyncify 성능 문제 없음. 타이틀/인트로/첫 방 정상.
- M2: 상태줄·동사 팝업·2줄 설명 대화창이 DOM span으로 좌표 일치 렌더(`shots/m2-*.png`). 콜백 예외 0.

## 알려진 함정
- **브라우저 탭이 hidden이면 엔진이 1틱/초로 스로틀**(Asyncify sleep = setTimeout). 프리뷰 패널이 접혀 있거나 Chrome 창이 가려지면 멈춘 듯 보임.
  검증은 `tools/smoke.mjs`(헤드리스, `--disable-background-timer-throttling`)로.
- build.sh는 시작 시 `git checkout -- . && git clean -fd engines backends dists`로 소스를 리셋 → 패치는 **먼저 .patch로 뽑고** 빌드.
  패치 편집 절차: 클론 트리에서 파일 수정 → `git add -N 신규파일` → `git diff -- engines/lure > engine-patches/01-*.patch`.
- `webtext.cpp` 맨 위 `#define FORBIDDEN_SYMBOL_ALLOW_ALL` 필수(ScummVM forbidden.h가 emscripten.h의 FILE과 충돌).
- Emscripten pre-js가 `Module.arguments`를 비우던 것을 패치 02로 보존. Web MIDI는 `Module.enableWebMIDI=true`일 때만 요청(권한 팝업 방지).
- `#start{display:flex}`가 `hidden`을 덮어씀 → `#start[hidden]{display:none}` 필요(한 번 당함).
- 메뉴바(상단 단어)는 비트맵 리소스라 레이어에 안 잡힘(v1 미번역 허용). 인트로/엔딩 자막은 애니메이션 프레임에 합성 → 훅 밖(M3에서 셸 자막).
- Lure 우클릭 팝업은 버튼을 **누른 동안** 표시되고 놓으면 선택 실행 — 모바일 트랙패드 모드(M4) 설계 시 반영.

## 다음 (별도 플랜)
- M3 한글: `onLureString`(stringId, 영문) 덤프 → 용어집/ko.json → 영문 블록 재조립·한글 재줄바꿈·조사 엔진 → i18n-check
- M4 V8: 터치(트랙패드 모드), agent8 클라우드 세이브(IDBFS `/home/web_user/saves` ↔ 컬렉션), @verse8/ads 타이틀/종료 1회, 고지 화면
