# 두 번째·세 번째 게임 계획 — Soltys(CGE) / Sfinx(CGE2)

Lure of the Temptress 웹판(이 레포)에 이어 같은 방식으로 올릴 다음 후보 두 개의 **사전 검증 결과와 작업 계획**.
작성 2026-09-09. 검증은 라이선스 원문·ScummVM 소스 실물 확인까지 마쳤다.
**2026-09-09 갱신: Soltys는 S1(빌드·부팅) 완료** — 아래 §7 참조. Sfinx(cge2)는 아직 사전 조사 상태.

---

## 1. 라이선스 판정 — 둘 다 진행 가능, 허락 불필요

두 게임 모두 `license.txt`가 **Lure와 동일한 6조 문구**이고, BASS·FOTAQ에 붙어 있던
"상업용 게임 컬렉션에 넣으려면 허락받아라"는 **프리앰블이 없다**.

| | Soltys | Sfinx |
|---|---|---|
| 권리자 | Laboratorium Komputerowe Avalon (폴란드) | 동일 |
| 연도 | 1995 (프리웨어 2011) | 1995 (영문판 2014) |
| 아카이브 | `soltys-en-v1.0.zip` 8.4MB | `sfinx-en-v0.3.zip` 34MB |
| sha256 | `87b89e654b8a5b8ebe342cb4c5c6049ab9a43a5efb474d9c49bafb77dcce48f6` | `304c2fc9399098534cb67d5752c41697890a5515d624e11f43b2538629fab187` |
| 내용물 | `vol.cat` `vol.dat` `license.txt` | `vol.cat` `vol.dat` `lang.eng` `license.txt` |
| 언어판 | en / es / pl | en(v0.3) |
| 출처 | `https://downloads.scummvm.org/frs/extras/Soltys/` | `.../extras/Sfinx/` |

준수 사항(Lure와 동일):
- 1조 — `license.txt`를 배포본에 동봉하고 고지 화면에 전문 노출
- 3조 — **게임 자체 유료화 금지**. 유료 해금·힌트 페이월 불가. 광고는 게임 요금이 아니므로 허용으로 해석(Lure와 같은 기준: 시작/종료 인터스티셜 + 자발적 힌트 광고)
- 4조 — 개조 시 "개조판" 명시. 우리는 **원본 데이터 무개조 + 화면 위 자막 레이어**라 "비공식 한글 자막, 원본 미개조" 고지로 충족
- 5조 — 모든 게임 콘텐츠 저작권은 Avalon

⚠️ Sfinx 영문판은 v0.3이고 아카이브에 `lang.eng` 마커가 있다. **영문 번역의 출처(팬 번역 여부)를 한 번 확인**할 것. license.txt는 "all game content is (C) Avalon"이라 문제없어 보이나, 배포 전에 ScummVM 위키/포럼에서 영문화 경위를 확인하면 안전하다.

---

## 2. 엔진 구조 — Lure보다 쉽다

Soltys = ScummVM `cge` 엔진, Sfinx = `cge2`. **cge2는 cge의 후속이라 구조가 거의 같다** — 훅 4개가 양쪽에 1:1로 존재한다.

| 훅 지점 | cge (Soltys) | cge2 (Sfinx) | 역할 |
|---|---|---|---|
| `Text::getText(int ref)` | `text.cpp:123` | `text.cpp:123` | **ref(정수) → 영문**. 번역 키가 이미 존재 |
| `Talk::update(const char *text)` | `talk.cpp:~128` | `talk.cpp:176` | 말풍선 텍스트를 **스프라이트 비트맵에 렌더**. 글리프 그리기 억제 지점 |
| `InfoLine::update(const char *text)` | `talk.cpp:214` | `talk.cpp:262` | 상단 상태줄 |
| `Sprite::show()` | `vga13h.cpp:429` | `vga13h.cpp:668` | 매 프레임 스프라이트를 `_x,_y`에 블릿 → **화면 좌표 확보** |

공통 사실:
- 화면 **320×200** (`cge_main.h` `kScrWidth`/`kScrHeight`), VGA mode 13h
- 폰트: `_widthArr[256]` 가변폭, `kFontHigh 8` → **8px 단일바이트, CJK 불가** (Lure와 동일한 이유로 DOM 자막 레이어가 유일한 답)
- 문자열 저장: `Text::load()`가 `ref = 문장` 형태의 줄을 읽어 `_cache[]`에 (ref, text) 쌍으로 전부 올려둔다. **허프만 압축이 아니라 평문** → 덤프가 Lure보다 훨씬 쉽다

### Lure와 결정적으로 다른 점

Lure는 텍스트를 **화면 표면에 직접** 그려서(`Surface::writeSubstring(x,y,…)`) 훅 한 곳에서 화면 좌표까지 같이 얻었다.
CGE는 텍스트를 **스프라이트 비트맵 안에** 그리고, 그 스프라이트를 나중에 `_x,_y`에 블릿한다. 따라서 **내용과 위치가 분리**된다:

1. `Talk::update(text)` — 이 Talk 스프라이트가 어떤 문자열인지 기록(포인터 → 문자열 맵)
2. `Sprite::show()` — 매 프레임, 그 맵에 있는 스프라이트면 `(x, y, w, h, text)`를 JS로 보고

대신 **한 줄씩이 아니라 말풍선 통째로** 넘어오므로, Lure에서 만든 블록 재조립(`src/text/blocks.ts`)이 필요 없다. 순증가와 순감소가 상쇄돼 전체 난이도는 Lure와 비슷하거나 조금 낮다.

---

## 3. 재사용할 수 있는 것 / 새로 써야 하는 것

**그대로 재사용(수정 없음 또는 소폭)**
- `src/i18n/josa.ts` 조사 엔진, `src/i18n/dict.ts` KoDict, `src/i18n/ui.ts` 셸 UI 사전
- `src/text/kolayout.ts` 한글 재줄바꿈·폰트 크기 선택, `src/text/layer.ts` DOM 렌더러
- `src/input/trackpad.ts` 터치, `src/input/keys.ts` 키보드, `src/verse8/*` 광고·게임서버, `src/save/*` 클라우드 세이브, `src/ui/notice.ts` 고지
- `engine-patches/02·03·04·05` (셸 pre-js, HTTP FS, 종료 훅, kFeatureNoQuit) — 엔진 공통이라 무수정
- `tools/prepare-deploy.sh`, `tools/push-verse8.sh`, `tools/smoke.mjs`, `tools/i18n-check.mjs`

**새로 써야 하는 것**
- `engine-patches/01-cge-text-hooks.patch` — 위 훅 4개 (Lure의 `webtext.{h,cpp}`를 CGE판으로 이식)
- `games/soltys/ko.json`, `glossary.json`, `strings.en.json`
- `src/i18n/status.ts` 대응물 — CGE에도 "동사 + 대상" 상태줄 합성이 필요한지 실물 확인 후 결정
- `tools/dump-strings.mjs`의 CGE판(Text::_cache 순회)

**중요: 레포를 새로 파지 말 것.** 이 레포가 "ScummVM 셸 = 재사용 코어"로 설계돼 있다.
`games/soltys/`를 추가하고 셸을 게임 인자로 일반화한 뒤, `prepare-deploy.sh <game>`이 게임별 `deploy/`를 뽑아 **V8 레포만 게임마다 따로** 만든다. 그래야 셸 개선(터치·키보드·세이브)이 세 게임에 동시에 적용된다.

---

## 4. 작업 계획

| 단계 | 내용 | 완료 판정 | 상태 |
|---|---|---|---|
| S0 | 라이선스 재확인(sha256), `tools/fetch-game.sh` 일반화, 영문판 출처 확인(Sfinx만) | 아카이브 검증 통과 | ✅ Soltys 완료 / Sfinx 미착수 |
| S1 | `--enable-engine=cge` 빌드 + 브라우저 부팅(영문) | 인트로~첫 화면 플레이 | ✅ **완료(§7)** |
| S2 | 훅 4개 + DOM 레이어를 **영문 패스스루**로 | 원본과 시각적 동등 | 다음 |
| S3 | 문자열 전수 덤프 → 용어집 → ko.json → i18n-check | 초반 구간 한글 완주 | |
| S4 | 셸 일반화(게임 선택), 터치·키보드·세이브·광고·고지 배선 | 폰 완주, 기기 간 이어하기 | 골격만 S1에서 선행 |
| S5 | `prepare-deploy.sh soltys` → 하위경로 스모크 → V8 push | 프리뷰 동작 | |

Sfinx는 S1·S2를 Soltys 훅에서 거의 복사할 수 있으므로 **Soltys를 먼저 끝내고 시작하는 편이 훨씬 싸다.**

---

## 5. 리스크와 미검증 항목

- ~~**미검증**: `cge`/`cge2` 엔진의 Emscripten 빌드 실적이 없다.~~ → **해소**: cge는 무수정으로 빌드·부팅·플레이됐다(§7). cge2(Sfinx)는 여전히 미검증이나 같은 계열이라 위험도는 낮아졌다.
- **미검증**: `Text::_cache` 순회 덤프는 소스를 읽고 설계했을 뿐 실행해 보지 않았다.
- **미검증**: 상태줄(`InfoLine`)이 Lure처럼 "동사 + 이름" 문자열 연결인지, 완성된 문장인지. 전자면 `status.ts`류 합성기가 또 필요하다.
- **번역량 미상**: Lure는 1,804문장이었다. CGE 텍스트 파일 규모는 덤프 전까지 모른다.
- **Sfinx 34MB**: Lure(8MB)보다 4배라 초기 로딩과 배포본 크기를 봐야 한다. 엔진 산출물까지 합치면 V8 레포가 50MB를 넘을 수 있다.
- **폴란드어 원본**: 두 게임 다 폴란드 게임이라 영문판이 이미 번역본이다. 한글은 영문 경유 중역이 된다.

---

## 6. 참고

- 이 레포 `NOTES.md` — Lure 구현의 함정 전부(엔진 패치 절차, 헤드리스 검증, 하위경로, agent8, 원스토어 요건)
- `docs/DEPLOY-VERSE8.md` — 배포 절차와 V8 AI 프롬프트
- `docs/ONESTORE-FORM.md` — 원스토어 지원 폼 답안(광고 timeoutMs 120초 등 필수 요건)
- 라이선스 원문은 각 아카이브의 `license.txt`


---

## 7. S1 결과 (2026-09-09) — Soltys 빌드·부팅 완료

**결론: cge 엔진은 ScummVM 소스 수정 없이 Emscripten으로 빌드되고, 브라우저에서 인트로부터 첫 화면 플레이까지 정상 동작한다.** 최대 미검증 리스크가 해소됐다.

### 실측
- 빌드: `ENGINES=lure,cge npm run engine:build` — 재configure 포함 약 1분(M1). cge 오브젝트 16개, 컴파일 경고 없음.
  wasm 10,276,222 → **10,448,517 바이트(+172KB)**. 즉 두 게임을 한 바이너리에 넣어도 비용이 거의 없다.
- 아카이브: `soltys-en-v1.0.zip` 3.4MB(sha256 문서값 일치) → `vol.cat` 50,176 / `vol.dat` 8,430,868 / `license.txt`.
  ⚠️ ScummVM 감지 테이블의 md5는 **파일 앞 5000바이트**의 md5다(`head -c 5000 | md5`). 전체 파일 md5와 비교하면 어긋난 것처럼 보인다.
  앞 5000바이트 기준으로 `f1675684…` / `4ffeff4a…` — 감지 엔트리 `soltys / Freeware v1.0 / EN_ANY`와 정확히 일치.
- 부팅: 엔진 기동까지 3.5초, `Running Sołtys (Freeware v1.0/DOS/English)`. Escape 2번으로 인트로 스킵 → 첫 화면(농가 마당).
  좌클릭으로 이동·대사("Don't come back without Leon, you bumbler!") 확인. pageerror 0.
  스크린샷 `docs/superpowers/plans/shots/s1-soltys-*.png`.
- Lure 회귀: 멀티엔진 빌드 후에도 `node tools/smoke.mjs --lang=ko` 전 항목 통과, vitest 62개 통과.

### S1에서 한 일 (셸 일반화 골격)
- `engine-patches/build.sh` — `ENGINES=lure,cge`(기본). 엔진 목록을 `.engines-stamp`에 남겨 **목록이 바뀌면 자동 재configure**.
  (config.mk가 남아 있으면 엔진을 추가해도 반영되지 않아 조용히 옛 바이너리가 나온다.)
- `tools/fetch-game.sh <game>` — 게임별 URL·sha256·검증 파일 테이블. `tools/stage-data.sh [game...]` — 인자 없으면 데이터가 있는 게임 전부 스테이징.
- `src/config.ts` — `GAMES` 레지스트리(타깃 id·제목·광고 placement·세이브 컬렉션·라이선스 파일). 선택은 `?game=<id>` → 없으면 `VITE_GAME` → 없으면 `lure`.
  `GAME_TITLE` 등 기존 export는 선택된 게임에서 파생되므로 소비자 코드는 그대로다.
- `public/scummvm.ini` — `[soltys]`(engineid=cge) 섹션 추가.
- `tools/smoke-boot.mjs` — 게임 무관 부팅 스모크(`--game --secs --keys --clicks`). `npm run smoke:boot -- --game=soltys`.

### 새로 알게 된 함정
- **캔버스 픽셀을 JS로 읽으면 항상 검은 화면이 나온다.** SDL3은 WebGL 캔버스라 드로잉 버퍼가 프레임 밖에서 비어 있어
  `drawImage`/`getImageData`가 빈 버퍼를 준다(간헐적으로만 맞는 값이 나와 더 헷갈린다). 검증은 **스크린샷을 찍어 디코드**해야 한다
  → `tools/lib/png.mjs`(zlib만 쓰는 최소 PNG 디코더).
- **`scummvm.ini`는 IDBFS에 한 번 들어가면 다시 안 받는다**(`_initSettings`: 파일이 있으면 fetch 생략).
  ini에 `[soltys]`를 추가해도 **이미 Lure를 플레이한 브라우저에는 반영되지 않는다.** 헤드리스 스모크는 매번 새 프로필이라 안 걸린다.
  두 게임을 같은 오리진(예: V8 하위경로)에 올리면 IDBFS를 공유하므로 S4/S5에서 처리해야 한다
  — ini에 없는 타깃이면 런타임에 섹션을 써 넣거나(ConfMan), 게임별 savepath/오리진 분리.

### S2 착수 전 확인된 사실
훅 4곳이 문서와 같은 위치에 실재한다(v2026.3.0): `Text::getText` `text.cpp:123` · `Talk::update` `talk.cpp:98` ·
`InfoLine::update` `talk.cpp:214` · `Sprite::show` `vga13h.cpp:429`. (문서의 Talk::update ~128은 98이 정확한 값.)
