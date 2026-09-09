# scummvm-web-v8 — ScummVM 웹판(한글 자막) 구조 노트

**이 레포는 게임 1개가 아니라 "ScummVM 셸 = 재사용 코어"다.** 현재 `lure`(완료) / `soltys`(S1 완료, 진행 중).
게임 선택은 `?game=<id>` → `VITE_GAME` → 기본 `lure`. 게임별 정의는 `src/config.ts`의 `GAMES` 레지스트리.
Soltys(cge) 진행 상황·함정은 `docs/NEXT-GAME-CGE.md` §7.

## 개요 (Lure)
- 게임: Lure of the Temptress (1992, Revolution Software) — 프리웨어. 라이선스 `games/lure/data/lure/LICENSE.txt` 6조
  (무료배포 OK · 상업배포물 포함 OK · **게임 유료화 금지** · 개조 시 명시). 원본 zip 무개조(sha256 고정).
- 엔진: ScummVM v2026.3.0, lure 엔진만 Emscripten(emsdk 6.0.0, `~/Downloads/emsdk`) 빌드. GPLv3 → `engine-patches/` 전체 공개.
- 한글: 엔진 내 CJK 불가(8×8 단일바이트 폰트) → DOM 텍스트 레이어. **M2 영문 패스스루 → M3 한글 완료**(1,804 문자열 + 액션 41개 100%).
- 설계 스펙: `docs/superpowers/specs/2026-09-06-lure-korean-web-design.md`, 플랜: `docs/superpowers/plans/`.

## 실행
    export PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH"
    npm install && npm run font:fetch
    npm run game:fetch -- lure && npm run game:fetch -- soltys   # 인자 없으면 lure
    npm run engine:build      # 클론(v2026.3.0)→패치→configure→make→dist. M1 Mac 기준 2~3분 (pkg-config 필요: brew install pkgconf)
                              # 엔진 선택은 ENGINES=lure,cge (기본). 목록이 바뀌면 .engines-stamp 로 자동 재configure
    npm run data:stage        # 데이터가 있는 게임 전부 → dist data/games/<id> + index.json, public/engine 심볼릭 링크
    npm run dev               # http://localhost:3046  (launch.json: scummvm-web-v8)
    npm test                  # vitest 9
    node tools/smoke.mjs [--lang=ko]   # Lure 전용 헤드리스 스모크(부팅→인트로 스킵→동사 팝업→대화창→닫기, 스크린샷 docs/superpowers/plans/shots/)
    npm run smoke:boot -- --game=soltys --keys=Escape,Escape --clicks=250,150   # 게임 무관 부팅 스모크
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

## M4 V8 통합
- **제목** `Lure of the Temptress (한글판)`(`src/config.ts` GAME_TITLE), 부제 "유혹의 마녀". 스토어 문안 `docs/STORE.md`.
- **터치**: `pointer: coarse`(또는 `?touch=1`)면 캔버스 위 `#touchpad` 오버레이가 터치 포인터를 받아 **합성 PointerEvent(pointerType 'mouse')** 를 캔버스에 디스패치. SDL3 Emscripten은 pointer 이벤트만 듣고 MouseEvent 합성은 무시(실측). 트랙패드 모드: 드래그=커서 이동(1:1), 탭=좌클릭, 롱프레스 400ms=우버튼 다운(동사 팝업, Lure 원작이 '누른 동안 표시'라 정확히 대응), 놓기=우버튼 업. 직접탭 모드 옵션. 마우스 포인터는 오버레이가 캔버스로 전달(하이브리드 기기).
- **클라우드 세이브**: `server/src/server.ts`(agent8, 컬렉션 `lure_saves`, 계정·슬롯별 base64) ↔ `src/save/*`. 전역 `FS`(비-MODULARIZE 빌드라 window.FS)로 `/home/web_user/saves` 스냅샷을 5초 폴링, 변경 시 업로드. 부팅 3초 후 diff: 클라우드 전용→다운로드, 로컬 최신→업로드, 둘 다 있고 클라우드 최신→confirm. 플랫폼 밖(`VITE_AGENT8_VERSE` 없음)이면 "저장: 로컬". 접속은 스토어 경유(`@agent8/gameserver/dist/src/store/useGameServerStore` 리터럴 딥임포트). SDK가 react 18 peer 요구 → 설치 필요.
- **광고**: `@verse8/ads` 정적 import, 인터스티셜 시작(`lure-start`)·종료(`lure-quit`) 각 1회. 호스트 밖은 1.5초 mock.
- **종료**: 패치 04(`emscripten-main.cpp` `main()` 끝 `Module.onLureQuit`) + 패치 05(`kFeatureNoQuit`→false; 업스트림은 웹에서 종료 대신 런처로 복귀) → 광고 → "다시 시작" 화면.
- **고지**: `src/ui/notice.ts` — 원본 LICENSE/README 전문(배포본 `engine/data/games/lure/`에서 fetch), 비공식 자막·무개조·GPLv3·OFL.
- **캔버스 맞춤**: 정수배→contain 소수 배율(폰 가로에서 정수배는 화면 절반). 세로 화면(coarse)이면 회전 안내.

## M5 배포 준비
- Verse8 빌더는 `bun run build`만 → **엔진 산출물을 실파일로 커밋**해야 함. `tools/prepare-deploy.sh` → `deploy/`(16MB: scummvm.js/wasm + data{lure.dat, scummmodern.zip, gui-icons, games/lure} + 셸 + server/ + engine-patches + 문서), V8용 package.json(emscripten 스크립트 제외), lock 파일 없음.
- 하위경로 검증: `node tools/serve-subpath.mjs` → `http://localhost:3047/g/lure/` → `smoke --lang=ko <url>` OK. 절대경로는 `assetUrl()`로 전부 제거, `base:'./'`, GAME_SIZE 핸드셰이크.
- 절차·V8 AI 프롬프트: `docs/DEPLOY-VERSE8.md`. **배포 push 완료(2026-09-06)**: `gitlab.verse8.io/hy.tae90/lure-of-the-temptress-kr` develop `5909aac`. 플랫폼 파일(.env/.agent8.lock/committedAt/PROJECT) 보존, 템플릿 .gitignore에 dist/·package-lock 병합.

## 원스토어(ONE store) 요건 대응 (2026-09-07)
- 폼 `[Verse8] Application Form for ONE Store` 요건 ↔ 구현: 광고 필수(전면 시작/종료 + **Opt-in 힌트 광고** `💡`), **모든 SDK 호출 `timeoutMs: 120_000`**(생략=30초=반려), 계정 서버 저장(agent8 `server/src/server.ts` — 검수기가 `server/src/*.ts`만 인정해 루트 server.js에서 이동), 한/영(게임 자막 + **셸 UI 전부** `src/i18n/ui.ts` data-ui), viewport, 가로 전용, 터치만으로 완주(Esc·⌨ 입력·y/n 버튼 보조), 설명 KO→EN(`docs/STORE-SHORT.md`), 확률형 없음.
- 답안: `docs/ONESTORE-FORM.md`. 검수기(`hakyong-tae/anything` v8-checker `check.py`)를 `deploy/`에 로컬 적용해 **통과(FAIL 0)** 확인 — 검수기는 `showInterstitial(`/`showRewarded(` 호출부를 전부 SDK 호출로 보므로 래퍼 이름은 `playInterstitialAd/playRewardedAd`.
- 힌트 콘텐츠 `games/lure/hints.json`(ko/en 8구간)은 우리가 쓴 공략 노트 — 원작 데이터 아님, 라이선스 3조와 무관. 합성 KeyboardEvent는 canvas dispatch로 SDL3에 전달됨(실측).

## 입력 보조 (26-09-08~09)
- **엔진 UI 상태 플래그**(패치 01 `emitState`): `Module.lureTalkSelect`(대화 선택지 목록 떠 있음) / `lurePopup`(동작 팝업, `PopupMenu::Show`에 RAII `PopupScope`) / `lureModal`(세이브·복원 창처럼 **엔진이 키보드를 직접 읽는 중**, `SaveRestoreDialog::show`에 `ModalScope`). 셸의 키보드·터치 보조는 이 플래그로만 켜진다 — 좌표 휴리스틱으로 판단하면 세이브 이름 입력 중 Enter를 가로채 저장이 깨진다.
- **터치**: 대화 선택지를 캔버스 위 금색 버튼으로 얹고(`#choices`), 탭하면 그 줄 좌표로 합성 클릭. 첫 회 "할 말을 골라 탭하세요" 토스트.
- **PC 키보드**: 선택지는 ↑↓로 합성 pointermove(엔진이 마우스 y로 선택), 팝업은 ↑↓를 합성 wheel로, 둘 다 Enter = 합성 좌클릭. 인덱스 계산은 `nextChoiceIndex`(순수 함수, 테스트).
- 검증: 팝업은 실게임에서 ↓→Enter로 "잠금 해제" 실행 확인. 선택지는 `Module.onLureText`에 TALK_SELECT 프레임을 주입해 pointermove/down/up 좌표가 각 줄에 정확히 꽂히는지 확인(스콜 경비가 순찰 스케줄이라 실게임 재현이 불안정). **미검증**: `lureModal`이 실제 세이브 창에서 1로 바뀌는지(헤드리스에서 Ctrl+S·메뉴바 진입 실패). 구조는 팝업과 동일한 RAII라 동작할 것으로 보나 실기기 확인 필요.

## 지시(Tell) 문장 합성
`Tell Ratpouch to Push Bricks and then Get Bottle and then finish`처럼 **이름 자리에 하위 액션 문장**이 오는 경우가 있다. 합성기는 `{2}`를 이름 사전으로만 바꿨기 때문에 "Push Bricks"가 영어로 남았다(사용자 리포트). 이제 `koPhrase()`가 ① 이름 사전 → ② "and then"으로 쪼개 각 조각을 `compose()` 재귀 → ③ 고정 단어 사전(list idx≥25, 플레이스홀더 없는 항목: and then/finish/nothing 등) 순으로 처리한다. 실제 데이터 회귀 테스트는 `tests/real-data.test.ts`(축소 픽스처가 놓치는 인덱스 어긋남을 잡는다).

## 검증 결과 (2026-09-06)
- M1: Chrome(가시 탭)에서 rAF 120/s, longtask 0 → Asyncify 성능 문제 없음. 타이틀/인트로/첫 방 정상.
- M2: 상태줄·동사 팝업·2줄 설명 대화창이 DOM span으로 좌표 일치 렌더(`shots/m2-*.png`). 콜백 예외 0.
- M4: `smoke --lang=ko --touch` OK(터치 에뮬레이션: 드래그 호버→롱프레스 팝업 한글 라벨→선택→대화창). M5: deploy/dist를 `/g/lure/`로 서빙해 `smoke --lang=ko` OK, 번들에 `"@agent8/gameserver"` bare specifier 0건.
- M3: `smoke --lang=ko` OK — 상태줄 "감옥 문을 잠그기", 팝업 "닫기/잠그기/열기", 2줄 설명창이 10px 한글로 말풍선 안에 재줄바꿈(`shots/m3-ko-*.png`). `i18n-check` 오류 0.

## 알려진 함정
- Vite dev 서버 기동 후 새 의존성을 설치하면 `504 Outdated Optimize Dep`로 모듈 로드가 통째로 실패(시작 버튼이 안 켜짐) → `rm -rf node_modules/.vite` 후 서버 재시작.
- 스모크의 인트로 스킵 Escape가 인트로 종료 후 도달하면 인게임 종료 확인("Are you sure (y/n)?")이 뜬다 → 스모크가 `n`으로 닫음.
- **캔버스 픽셀을 JS(`drawImage`/`getImageData`)로 읽으면 검은 화면이 나온다** — WebGL 드로잉 버퍼가 프레임 밖에서 비어 있다.
  간헐적으로 맞는 값이 섞여 나와 더 헷갈린다. 화면 검증은 스크린샷을 찍어 디코드할 것(`tools/lib/png.mjs`).
- **`scummvm.ini`는 IDBFS에 한 번 저장되면 다시 fetch 하지 않는다** — ini에 게임 섹션을 추가해도 이미 플레이한 브라우저엔 반영 안 됨.
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
