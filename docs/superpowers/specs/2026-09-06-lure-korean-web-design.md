# Lure of the Temptress — 무설치 웹판 + 한글 자막 레이어 설계

날짜: 2026-09-06 · 상태: 승인(사용자 확정) · 저장소: `~/Downloads/scummvm-web-v8/` · 포트 3045

## 1. 목표

Revolution Software가 프리웨어로 공개한 *Lure of the Temptress*(1992)를 ScummVM Emscripten 빌드로 Verse8에
**설치 없이·한글로·기기 간 이어하기 되는** 단일 게임 엔트리로 올린다. ScummVM 셸은 이후 다른 프리웨어
고전게임(허락 확보 시)에 재사용 가능한 내부 코어로 설계하되, v1 산출물은 Lure 엔트리 1개다.

## 2. 법적 전제 (검증 완료 2026-09-06)

- 게임 데이터 라이선스: `lure/LICENSE.txt` 6조. 무료 배포 허용(1조), 상업 배포물 내 포함 허용(2조),
  **게임 자체 유료화 금지**(3조), 개조 허용·개조판 명시(4조). BASS/FOTAQ와 달리 **프리앰블 없음**.
- 따라서 유료 판매·유료 해금·힌트 페이월 전부 금지. 광고는 "게임 요금"이 아니므로 허용으로 해석하되 최소화.
- 엔진 ScummVM = GPLv3 → 패치 포함 전체 소스 공개, agent8/@verse8 SDK는 셸(별도 프로세스·별도 저작물)에만.
- BASS/FOTAQ는 프리앰블("상업용 게임 컬렉션은 허락 필요") + 현역 상업판 존재 → **허락 없이 포함하지 않음**.
- 원본 zip은 바이트 단위 무개조. `README`/`LICENSE.txt` 동봉·게임 내 고지 화면에 전문 표시.

## 3. 결정 사항

| 축 | 결정 | 이유 |
|---|---|---|
| V8 단위 | 게임 1개 = 엔트리 1개 | 노출·지표·CPP 재평가가 게임 단위 |
| 한글 렌더 | **DOM 텍스트 레이어** (엔진 글리프 억제 + 캔버스 좌표 정렬 `<span>`) | 8×8 단일바이트 폰트 엔진에 CJK 경로 없음; 웹폰트로 제약 제거 |
| 번역 저장 | 외부 `ko.json` (stringId → 템플릿) | 대사가 허프만 압축 스트림이라 재주입 불필요·원본 무개조 |
| V8 통합 | 클라우드 세이브(핵심) + 타이틀/종료 인터스티셜 1회 | 3조 준수, 원작자 인상 관리 |
| 제외(v1) | 허브 UI, BASS/FOTAQ, 리더보드, PWA 오프라인, 클라우드 스토리지 | YAGNI |

## 4. 아키텍처

```
scummvm-web-v8/
├── engine-patches/                  # ScummVM(GPLv3) 소스 패치. 게임 로직 불변.
│   ├── 01-getstring-hook.patch      # StringData::getString(stringId, hotspotName, characterName, articles) → JS
│   ├── 02-writesubstring-hook.patch # Surface::writeSubstring(x, y, str, len, color) → JS, 글리프 draw 억제 플래그
│   └── build.sh                     # dists/emscripten/build.sh 래퍼 (--disable-all-engines --enable-engine=lure)
├── engine/                          # 빌드 산출물 scummvm.{js,wasm,data} (커밋 X, .gitignore)
├── games/lure/
│   ├── data/lure-1.1.zip            # 원본 무개조 + 동봉 README/LICENSE.txt (커밋 X, 스크립트로 다운로드·sha256 검증)
│   ├── glossary.json                # 고유명사 표기 고정
│   └── ko.json                      # { "<stringId>": { "t": "…{hotspot:을}…", "max": <영문 길이> } }
├── src/                             # Vite + TS 웹 셸
│   ├── main.ts        # 부트, 언어 선택, 씬 전환(타이틀→게임→고지)
│   ├── engine.ts      # Emscripten Module 로딩, 콜백 바인딩(onGetString/onWriteSubstring), IDBFS 마운트
│   ├── textlayer.ts   # 캔버스↔DOM 좌표 변환, span 풀, 타이프라이터(len) 재현, 색상 팔레트 매핑
│   ├── i18n/josa.ts   # 받침 기반 조사 치환 (순수 함수)
│   ├── i18n/lookup.ts # stringId → ko 템플릿 → 이름·조사 치환 → 최종 문자열
│   ├── touch.ts       # 트랙패드 모드(기본)/직접탭 모드, 롱프레스=우클릭, 가로 강제 안내
│   ├── save.ts        # IDBFS 세이브 파일 ↔ agent8 컬렉션 base64 동기화, mtime 충돌 처리
│   ├── ads.ts         # @verse8/ads 인터스티셜(타이틀 진입·세션 종료)
│   └── notice.ts      # 고지 화면: LICENSE 전문, 비공식 한글 자막·데이터 미개조 명시, GPL 소스 링크
├── tools/
│   ├── fetch-game.sh          # scummvm.org에서 zip 다운로드 + sha256 검증
│   ├── dump-strings.mjs       # 헤드리스로 wasm 부팅, id 0..0xfa0 getString 전수 → strings.en.json
│   └── i18n-check.mjs         # 미번역·플레이스홀더 불일치·용어집 위반·길이 초과 리포트 (CI)
├── server.js                  # agent8 gameserver: saveSlot upsert/get (유저별)
├── tests/                     # vitest
├── index.html  vite.config.ts  package.json  NOTES.md
└── docs/superpowers/specs/…
```

### 4.1 엔진 훅 (패치 2개)

- **getString 훅**: 기존 함수 진입부에서 `EM_ASM`으로 `(stringId, hotspotName, characterName, hotspotArticle, characterArticle)`을 JS에 전달하고, JS가 번역 문자열을 돌려주면 그걸 `dest`에 쓰고 원래 디코딩을 생략. JS가 `null`을 돌려주면 원래 경로(영문) 그대로. → 번역 lookup은 **의미 단위**에서 일어남.
- **writeSubstring 훅**: `(x, y, str, len, color, transparent)`를 JS에 전달. 텍스트 레이어가 활성화된 언어면 원본 글리프 draw를 건너뜀(리턴), 아니면 원본 그대로. 말풍선 배경·상자는 엔진이 계속 그림.
- 두 훅 모두 `#ifdef __EMSCRIPTEN__` 가드. 비-웹 빌드는 무변경.
- 화면 크기 계산(`getDialogBounds`)은 영문 기준 그대로 둠 → 한글이 대개 더 짧아 안쪽에 들어감. 넘치는 케이스는 `ko.json.max`로 번역 단계에서 차단.

### 4.2 텍스트 레이어

- 캔버스는 320×200을 CSS로 정수배 스케일. 레이어 `<div>`를 캔버스 위에 동일 크기로 겹치고, `span.style.transform = translate(x*s, y*s)`.
- 프레임마다 훅 호출이 반복되므로 (x,y,str) 키로 span 재사용, 한 프레임 동안 호출되지 않은 span은 제거(엔진이 지운 텍스트 = 화면에서 사라짐).
- `len < str.length`면 부분 문자열 렌더 → 타이프라이터 연출 유지.
- 폰트: 픽셀 한글(갈무리 계열 등) — **M0에서 재배포 라이선스 확정 후 채택**. 폴백 스택 필수.
- 색상: 엔진 팔레트 인덱스 → RGB 매핑 테이블(엔진에서 현재 팔레트를 함께 넘김).

### 4.3 번역 데이터

- `strings.en.json`: 덤프 결과(원문, 템플릿 형태). 커밋함(원문은 라이선스상 배포 가능).
- `ko.json` 항목: `{ "t": "…", "max": N }`. 템플릿 문법 `{hotspot}` `{char}` `{hotspot:을}` `{char:이}`.
- 조사 규칙: 마지막 음절 받침 유무(+ㄹ 받침은 '로/으로' 예외)로 은/는·이/가·을/를·와/과·로/으로. 영문 이름(받침 판정 불가)은 이름 테이블에 발음 기준 받침 플래그를 둔다.
- 용어집 위반·미번역·플레이스홀더 불일치·길이 초과는 `i18n-check`가 0건이어야 빌드 통과.

### 4.4 세이브 동기화

- ScummVM savepath → IDBFS `/saves`. 엔진의 세이브/로드 다이얼로그 종료(훅: 기존 `SaveRestoreDialog` 종료 시 JS 이벤트 1줄)에서 `FS.syncfs` 후 변경 파일을 base64로 agent8 `saves` 컬렉션에 `{userId, slot, mtime, data}` upsert.
- 부팅 시 클라우드 목록과 로컬 mtime 비교, 클라우드가 최신이면 확인 프롬프트 후 덮어씀.
- 실패(오프라인·미로그인)는 조용히 로컬만 사용, 배지로 표시.

### 4.5 입력

- 트랙패드 모드(기본): 드래그 = 커서 이동(가속 없음, 1:1 스케일), 탭 = 좌클릭, 롱프레스(400ms) = 우클릭. 직접탭 모드: 탭 위치로 커서 순간이동 후 클릭.
- PC: 마우스/키보드 그대로.
- 세로 화면: 회전 안내 오버레이. 가로에서 캔버스 최대 정수배.

## 5. 에러 처리

- wasm 로딩 실패/미지원 브라우저 → 안내 화면(필요 사양).
- 훅 콜백 예외는 JS에서 잡아 원본 경로로 폴백(영문 표시) + 콘솔 리포트. 절대 엔진을 죽이지 않는다.
- 번역 누락 stringId → 영문 그대로 표시 + 디버그 모드에서 id 배지.
- 클라우드 세이브 실패 → 로컬 유지, 재시도 백오프.

## 6. 검증

- vitest: `josa` 전 규칙, `lookup` 치환·폴백, `ko.json` 스키마, 세이브 base64 왕복, 좌표 변환.
- 스모크: 헤드리스 부팅 → 인트로 진입 (`?raf=timer` 트릭).
- 수동 게이트: 첫 방 탈출(Skorl 처치)까지 한글 완주(PC), 폰에서 동일 구간 + 기기 간 이어하기.

## 7. 마일스톤

| | 내용 | 완료 판정 |
|---|---|---|
| M0 | 폰트 라이선스 확정, `fetch-game.sh`, Revolution 통보 메일 초안 | 폰트 재배포 가능 확인 |
| M1 | emsdk 셋업 + lure 단일 엔진 빌드 + 영문 원본 브라우저 부팅 + 성능 실측 | 인트로~첫 방 플레이 |
| M2 | 훅 2개 + DOM 텍스트 레이어(영문을 DOM으로) | 원본과 시각 동등 |
| M3 | 덤프 + 용어집 + 한글 + 조사 엔진 + i18n-check | 첫 방 한글 완주 |
| M4 | 터치 + 클라우드 세이브 + 광고 + 고지 화면 | 폰 완주, 기기 간 이어하기 |
| M5 | V8 배포(gitlab develop) | 프리뷰 동작 |

## 8. 알려진 리스크

- Emscripten Asyncify 성능 페널티(공식 문서 명시) → M1 실측으로 판정.
- 캔버스 합성 텍스트(인트로·엔딩 자막)는 훅에 안 걸림 → v1은 셸 하단 자막.
- 짧은 영문→긴 한글 넘침 → `max` + i18n-check.
- ScummVM 시작 직후 화면비 버그(공식 known issue) → 셸에서 리사이즈 1회 강제.
- 픽셀 한글 폰트 라이선스 미확정 → M0 게이트.
