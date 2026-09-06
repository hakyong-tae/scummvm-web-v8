# scummvm-web-v8 — Lure of the Temptress 웹판 구조 노트

## 개요
- 게임: Lure of the Temptress (1992, Revolution Software) — 프리웨어. 라이선스 `games/lure/data/lure/LICENSE.txt` 6조
  (무료배포 OK · 상업배포물 포함 OK · **게임 유료화 금지** · 개조 시 명시). 원본 zip 무개조(sha256 고정).
- 엔진: ScummVM v2026.3.0, lure 엔진만 Emscripten(emsdk 6.0.0, `~/Downloads/emsdk`) 빌드. GPLv3 → `engine-patches/` 전체 공개.
- 한글: 엔진 내 CJK 불가(8×8 단일바이트 폰트) → DOM 텍스트 레이어. **M2 영문 패스스루 → M3 한글 완료**(1,804 문자열 + 액션 41개 100%).
- 설계 스펙: `docs/superpowers/specs/2026-09-06-lure-korean-web-design.md`, 플랜: `docs/superpowers/plans/`.

## 실행
    export PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH"
    npm install && npm run game:fetch && npm run font:fetch
    npm run engine:build      # 클론(v2026.3.0)→패치→configure→make→dist. M1 Mac 기준 2~3분 (pkg-config 필요: brew install pkgconf)
    npm run data:stage        # 게임 파일 → dist data/games/lure + index.json, public/engine 심볼릭 링크
    npm run dev               # http://localhost:3046  (launch.json: scummvm-web-v8)
    npm test                  # vitest 9
    node tools/smoke.mjs [--lang=ko]   # 헤드리스 스모크(부팅→인트로 스킵→동사 팝업→대화창→닫기, 스크린샷 docs/superpowers/plans/shots/)
    npm run strings:dump      # 엔진 훅으로 문자열 전수 덤프 → games/lure/strings.en.json
    npm run i18n:check        # ko.json 검수(커버리지·플레이스홀더·조사·용어집·길이)

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

## M3 한글 파이프라인
- **키 체계**: 문자열 ID 공간이 방 번호에 따라 테이블 1/2를 겹쳐 쓰므로(`StringData::resolveTable`: 방≥0x2A면 0x7d0~0xfa0가, <0x2A면 ≥0xfa0가 0x76으로 대체) 번역 키는 `"<table>:<local>"`. `games/lure/ko.json` = `{list:{액션idx:템플릿}, t:{키:템플릿}}`.
- **덤프**: `Module.lureDumpRequest=1` → 엔진 `present()`에서 폴링(Asyncify 중 JS→wasm 직접 호출 불가) → `StringData::getStringRaw`(방 리맵 없음, `%1/%2`→`\x01/\x02`→`{hotspot}/{char}`) + `StringList` → `Module.onLureDump(json)`. 테이블 문자열 수 = `READ_LE_UINT16(tbl+2) − READ_LE_UINT16(tbl)`.
- **런타임**: `getString` 훅이 `(table, local, 영문최종, hotspotName, charName)`을 `onLureString`으로 → `KoDict.onString`이 템플릿에 이름(영문 이름→ko 역색인)·조사(`{hotspot:을}`)를 채워 **영문최종→한글최종 맵** 등록 → 레이어가 레코드를 블록으로 묶어 `resolveBlock`: ① 모든 줄이 개별 번역되면 줄 단위(팝업 메뉴·대화 선택지) ② 아니면 join 후 맵 조회(문단) ③ prefix 일치면 타이프라이터 비율 ④ 없으면 영문.
- **상태줄**: `"<action> <name>[ to/for/on <name2>]"` 문자열 연결이라 `StatusComposer`가 액션 템플릿(`{1:을} 보기|보기` — `|` 뒤는 팝업용 단독 라벨)으로 합성. 연결어 인덱스 S_FOR=35/S_TO=36/S_ON=37.
- **레이아웃**: `layoutKorean` — 블록 폭+8px 안에서 10→7px 순으로 가장 큰 폰트, 줄 수×폰트 ≤ 블록 높이+6. NeoDGM은 canvas `measureText`로 실측(10배 크기로 재서 반올림 오차 축소).
- **조사**: 받침 판정(유니코드), ㄹ받침 '로', 영문 이름은 자음 끝=받침 폴백. 지원: 을/를 은/는 이/가 과/와 으로/로 아/야.
- **번역 규칙**: 서술은 '~다' 체(2인칭 '당신' 최소화), 랫파우치→디어모트 존댓말('나리/주인님'), 스콜은 거친 반말, 울타르는 조사 생략 말투. 용어집 `glossary.json`. 디버그 문자열(ROOMxx/MEGAxx/NULL)은 검수에서 제외.
- **미번역 영역**: 상단 메뉴바(비트맵), 인트로/엔딩 자막(프레임 합성). 저장 슬롯 이름은 사용자 입력.

## 검증 결과 (2026-09-06)
- M1: Chrome(가시 탭)에서 rAF 120/s, longtask 0 → Asyncify 성능 문제 없음. 타이틀/인트로/첫 방 정상.
- M2: 상태줄·동사 팝업·2줄 설명 대화창이 DOM span으로 좌표 일치 렌더(`shots/m2-*.png`). 콜백 예외 0.
- M3: `smoke --lang=ko` OK — 상태줄 "감옥 문을 잠그기", 팝업 "닫기/잠그기/열기", 2줄 설명창이 10px 한글로 말풍선 안에 재줄바꿈(`shots/m3-ko-*.png`). `i18n-check` 오류 0.

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
- 한글 감수: LLM 초벌 상태. 실플레이하며 톤/오역 수정(특히 대화 선택지 길이).
- M4 V8: 터치(트랙패드 모드), agent8 클라우드 세이브(IDBFS `/home/web_user/saves` ↔ 컬렉션), @verse8/ads 타이틀/종료 1회, 고지 화면
