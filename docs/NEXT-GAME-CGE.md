# 두 번째·세 번째 게임 계획 — Soltys(CGE) / Sfinx(CGE2)

Lure of the Temptress 웹판(이 레포)에 이어 같은 방식으로 올릴 다음 후보 두 개의 **사전 검증 결과와 작업 계획**.
작성 2026-09-09. 검증은 라이선스 원문·ScummVM 소스 실물 확인까지 마쳤다.
**2026-09-09 갱신: Soltys는 S1~S5 완료** — 아래 §7~§11 참조. 남은 것은 V8 프로젝트 생성 + push(토큰 필요)와 한글 감수. Sfinx(cge2)는 아직 사전 조사 상태.

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
| S2 | 훅 4개 + DOM 레이어를 **영문 패스스루**로 | 원본과 시각적 동등 | ✅ **완료(§8)** |
| S3 | 문자열 전수 덤프 → 용어집 → ko.json → i18n-check | 초반 구간 한글 완주 | ✅ **완료(§9)** — 화면 문자열 100% |
| S4 | 셸 일반화(게임 선택), 터치·키보드·세이브·광고·고지 배선 | 폰 완주, 기기 간 이어하기 | ✅ **완료(§10)** — 클라우드 세이브는 배포 후 확인 |
| S5 | `prepare-deploy.sh soltys` → 하위경로 스모크 → V8 push | 프리뷰 동작 | ✅ **배포본까지 완료(§11)** — push는 토큰·프로젝트 필요 |

Sfinx는 S1·S2를 Soltys 훅에서 거의 복사할 수 있으므로 **Soltys를 먼저 끝내고 시작하는 편이 훨씬 싸다.**

---

## 5. 리스크와 미검증 항목

- ~~**미검증**: `cge`/`cge2` 엔진의 Emscripten 빌드 실적이 없다.~~ → **해소**: cge는 무수정으로 빌드·부팅·플레이됐다(§7). cge2(Sfinx)는 여전히 미검증이나 같은 계열이라 위험도는 낮아졌다.
- ~~**미검증**: `Text::_cache` 순회 덤프~~ → **해소**: `Text::webDump()`로 327 ref / 12,886자 덤프 성공(§8).
- ~~**미검증**: 상태줄(`InfoLine`)이 …~~ → **해소**: CGE 상태줄은 합성 문장이 아니라 **스프라이트 이름 하나**("A kennel")다. `status.ts`류 합성기 불필요. 대신 이름들이 SAY 파일이 아니라 스프라이트 데이터에 있어 덤프로 열거되지 않는다(§8).
- ~~**번역량 미상**~~ → **확정**: CGE.SAY = **327문장 / 12,886자**(Lure 1,804문장의 약 1/5). 여기에 스프라이트 이름(핫스팟 라벨)이 별도로 붙는다.
- **Sfinx 34MB**: Lure(8MB)보다 4배라 초기 로딩과 배포본 크기를 봐야 한다. 엔진 산출물까지 합치면 V8 레포가 50MB를 넘을 수 있다.
- **폴란드어 원본**: 두 게임 다 폴란드 게임이라 영문판이 이미 번역본이다. 한글은 영문 경유 중역이 된다.
  (Soltys 영문판은 ref 17 크레딧에 따르면 **원작자 Janusz Wiśniewski 본인이 참여**했다 — 중역이지만 원작자 승인 판본.)

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


---

## 8. S2 결과 (2026-09-09) — 훅 4개 + DOM 레이어 영문 패스스루 완료

`engine-patches/06-cge-text-hooks.patch`(신규, GPLv3). **셸(`src/`)은 한 줄도 안 고쳤다** — CGE가 Lure와 같은 레코드 JSON을 내보내므로 `text/layer.ts`·`blocks.ts`·`diff.ts`가 그대로 동작한다.

### 훅 설계 — Lure보다 단순하다
CGE는 텍스트를 스프라이트 비트맵에 그리고 나중에 블릿하므로 **내용과 위치가 분리**된다(§2). 그래서:

| 지점 | 하는 일 |
|---|---|
| `Talk::update(text)` | 이 Talk 스프라이트가 무엇을 그렸는지 기록. `\|`·`\n`으로 줄을 쪼개고 엔진과 **같은 규칙**으로 줄 폭을 잰다(넓은 space는 2px 덜 전진) |
| `InfoLine::update(text)` | 상태줄 — 여백 0의 한 줄 |
| `Sprite::show()` | 이 프레임에 (x,y)로 블릿된 스프라이트면 줄들을 화면 좌표로 옮겨 프레임 목록에 적재 |
| `Vga::update()` | `copyRectToScreen` 직후 프레임 목록을 JSON으로 `Module.onLureText`에 방출하고 비운다 |
| `Text::getText(ref)` | `Module.onLureString(0, ref, 영문, "", "")` — 번역 키가 **ref 정수**라 Lure의 테이블/로컬 2단 키가 필요 없다 |
| `~Sprite()` | 기록 제거 |

Lure가 필요로 했던 표면 추적·`transfer`·"글자색 픽셀 4개 미만이면 사라진 것" 판정이 **전부 불필요**하다.
프레임마다 목록을 새로 만들기 때문에, 말풍선이 사라지면 그냥 다음 프레임 목록에 없다.
`Vga::update()`는 `Vga::show()`에서만 호출되므로(확인함) 스프라이트 순회 직후 정확히 한 번 방출된다.

색은 `g_system->getPaletteManager()->grabPalette()`로 실제 화면 팔레트에서 읽는다(CGE 내부 `_sysPal`/`_newColors` 대신).

### 검증 (`tools/smoke-boot.mjs --steps=...`)
| 텍스트 면 | 확인된 레코드 |
|---|---|
| 말풍선(Talk) | `Don't come back without Leon, you bumbler!@6,40` |
| 상태줄(InfoLine) | `A kennel@177,164` · `A bone@177,164` · `Chief@177,164` — 좌표가 `kInfoX,kInfoY`(177,164)와 정확히 일치 |
| 메뉴(Vmenu) | `I've had enough of this game!@103,91` · `Whoops! I want to continue!@103,101` — 줄 간격 10px = `kFontHigh+kTextLineSpace` |
| `getText` | ref 1005·200·201·202·102 등 (ref, 영문) 쌍 도착 |

스크린샷 `shots/s2-soltys-{balloon,infoline,menu}.png` — DOM span이 엔진 글리프를 덮고 같은 자리에 그려진다. 메뉴 선택 강조바(MenuBar)는 별도 스프라이트라 그대로 보인다.
Lure 회귀 스모크 전 항목 통과, vitest 62개 통과.

### S3에 넘길 사실
- **번역량 = CGE.SAY 327문장 / 12,886자** (`games/soltys/strings.en.json`, `npm run strings:dump -- --game=soltys`). Lure(1,804)의 약 1/5.
  ref는 장면별로 흩어져 있다(1000번대=농가, …, 26000번대=결혼식, 28000번대=발단).
- **스프라이트 이름은 SAY에 없다.** 상태줄에 뜨는 "A kennel"·"A bone"·"Chief"는 스프라이트 데이터에서 오므로 덤프로 열거되지 않는다.
  → 런타임에 `InfoLine::update`로 들어오는 영문 이름을 사전으로 치환하는 방식(Lure의 KoDict와 같은 형태)이 필요하고, 목록은 플레이하며 수집해야 한다.
- **ref 10~17은 번역 대상이 아니다.** CP437 박스문자로 그린 DOS 타이틀 아트("ÚÄ¿…")와 크레딧이다. 일반 플레이 흐름에서는 화면에 안 나온다(인트로 40초 관찰 중 레코드 0건).
- ref 17 = `Translation by|Janusz Wiśniewski (original author)|Dan Serba` — **영문판은 원작자 본인이 참여한 공식 영문화**다. Sfinx 영문판 출처 확인(§1 ⚠️)에도 참고가 된다.

### 함정
- **새 파일을 `git add -N` 한 채로 두면 build.sh가 깨진다.** `git clean`이 인덱스에 올라간 파일을 지우지 못해
  `error: engines/cge/webtext.cpp: already exists in working directory`가 난다. 패치를 뽑은 뒤 반드시 `git reset <새 파일>`.
- 콜백 이름은 **`onLureText`/`onLureString`/`onLureDump`를 그대로 쓴다.** 이제 Lure 전용이 아니라 **셸 전체의 이름**이다
  (패치 02~05와 `src/`를 손대지 않기 위한 선택). Sfinx까지 붙일 때 한 번에 `onEngineText` 등으로 바꾸는 편이 낫다.


---

## 9. S3 결과 (2026-09-09) — 한글 100%

`games/soltys/{ko.json, glossary.json, strings.en.json}` + `src/i18n/dictRef.ts`.

### 사전 구조 — Lure보다 훨씬 단순
CGE는 조사 합성(`StatusComposer`)도, 이름 역색인도 필요 없다. 상태줄이 합성 문장이 아니라 이름 하나이기 때문이다.
`RefDict`는 **영문 최종 문자열 → 한글** 맵 하나가 전부다.

    ko.json = { t: { "<SAY ref>": "한글(\n=줄바꿈)" },
                names: { "영문 스프라이트 이름": "한글" },
                skip: { "<ref>": "미번역 사유" } }

`normalizeRef`가 `|`·`\n`을 공백으로 바꿔 정규화한다 — 엔진은 `|`에서 줄을 나눠 그리고 레이어는 그 줄들을 공백으로
이어 조회하므로, SAY 원문의 `|`와 화면의 줄 나눔이 같은 키로 맞아떨어진다.

### 커버리지
| | 수 |
|---|---|
| SAY 번역 | **291 / 291** (전체 327 중 36은 의도적 미번역) |
| 스프라이트 이름 | **261** (전수) |
| 의도적 미번역 | DOS 타이틀 아트·크레딧(10~19), 사운드카드 설정(50~66), 실행 요구사항 오류(90~99), `DEMO`·숫자·공백 |

**스프라이트 이름 전수 확보 방법**(§8에서 "플레이하며 수집해야 한다"고 봤던 문제):
`vol.dat` 전체가 **단일 바이트 XOR 0xA5**(`cge/cge.h` `kCryptSeed`)라 통째로 풀고 `.SPR`의 `name=` 줄을 훑으면 된다
→ `tools/dump-cge-names.py`(`npm run names:dump`), 261개. B-트리(`vol.cat`) 파싱 불필요.
⚠️ `.SPR` 텍스트가 이진 데이터 **바로 뒤에** 붙어 있어 줄머리 앵커(`^name=`)로 찾으면 절반(75개)만 잡힌다.

### 셸 변경(작게)
- `src/i18n/dictRef.ts` 신규. `src/text/blocks.ts`의 줄 간격을 인자로(`PitchRange`) — **CGE는 10px라 Lure 기본값 7~9px로는 문단이 안 묶인다.**
  게임별 값은 `GameDef.linePitch`, 레이어에 `setPitch()`.
- `GameDef.i18n: 'lure' | 'ref'`로 `loadKorean()`이 사전 종류를 고른다. `games/<id>/`에서 fetch.
- `tools/i18n-check.mjs`가 `strings.en.json`에 `say`가 있으면 ref 검수로 전환:
  없는 ref·t/skip 중복·**한글 줄 수가 영문 줄 수를 넘김(말풍선 높이는 영문 줄 수로 정해진다)**·길이·용어집.

### 검증
헤드리스 `--lang=ko` 통과 — 말풍선·상태줄(개집/뼈다귀/촌장/게임 종료)·메뉴 2줄이 전부 한글, 영문 잔재 0.
`shots/s3-soltys-ko-*.png`. i18n-check 오류 0·경고 0. Lure 회귀 통과, vitest 73개 통과.

### 남은 것
- **감수 미실시** — LLM 초벌이다. 실플레이하며 말투(촌장=시골 반말, 신부=존대)와 오역을 다듬어야 한다.
- 말장난 3곳은 의역했다: 14001~14006 `Knott shot / Hot shot / Not`(낫/낮), 26011~26012 `F-fuc.../f-fact`,
  3001(일부러 뭉갠 발음). 감수 때 재검토 대상.
- 20021~20022는 **원작의 ALT 키 이스터에그**를 그대로 옮겼다. 웹에서 ALT가 먹는지 확인 필요.


---

## 10. S4 결과 (2026-09-09) — 셸 일반화

게임별로 갈라지는 것만 `GameDef`로 뽑고, 나머지는 두 게임이 같은 코드를 쓴다.

### `scummvm.ini`의 게임 섹션을 없앴다 (§7의 IDBFS 함정 해소)
게임을 **`--path=/data/games/<id> <target>` 인자로** 띄우면 ini에 게임 섹션이 없어도 실행된다(두 게임 모두 실측).
ini에는 `[scummvm]` 전역 설정만 남는다 → **IDBFS에 캐시된 낡은 ini 때문에 새 게임이 안 뜨는 문제가 원천적으로 사라진다.**
(같은 오리진에서 세이브는 파일명이 달라 충돌하지 않는다: `lure.001` vs `soltys.001`.)

### `GameDef`에 들어간 것
`id` `name` `title` · 광고 placement 3종 · `saveCollection` · `licenseFiles` · `i18n`(사전 형태) · `linePitch` ·
**`text: { ko, en }`** = 부제 · 터치/PC 조작 안내 · 고지 화면의 "원작" 문단.
`applyUiLang()`이 공통 `ui.ts` 위에 `gameText(lang)`을 덮어쓰므로 `data-ui` 마크업은 그대로다.
조작 규칙이 게임마다 다르다는 게 핵심 — Lure는 "우클릭 홀드 = 동작 메뉴", **Soltys는 "좌클릭 = 걷기·살펴보기 / 우클릭 = 사용·집기"**(실측).

### 저장 키 분리
- 셸 공통(`svm.*`): 언어, 터치 모드 — 같은 오리진의 게임끼리 공유해도 되는 것.
- 게임별(`svm.<id>.*`): 조작 안내 토스트, 힌트 해금 — 게임마다 조작과 힌트가 다르다.
- 기존 배포(Lure)의 `lure.*` 키는 최초 1회 자동 이전한다(언어 설정이 초기화되지 않도록).

### 검증
- **종료 훅이 CGE에서도 동작한다**: 패널 종료 아이콘 → 메뉴 → "이 게임 이제 지겹다!" → `Module.onLureQuit` 호출 → 광고 → 재시작 화면.
  패치 04·05는 `emscripten-main.cpp` 수준이라 엔진과 무관하게 먹는다(예상대로).
- **폰 터치**(844×390, 트랙패드 모드): 가상 커서 드래그로 개집/뼈다귀 위 상태줄이 바뀌고, 롱프레스가 우버튼으로 전달된다.
  `tools/smoke-boot.mjs --touch`. 스크린샷 `shots/s4-soltys-phone.png`.
- 고지 모달이 `license.txt` 전문(1,297자)을 싣고, 힌트 8구간 24개가 한/영으로 뜬다.
- Lure 회귀: 마우스·터치 스모크 모두 통과, vitest 73개 통과.

### 아직 확인 못 한 것
- **클라우드 세이브(기기 간 이어하기)** — agent8은 Verse8 플랫폼 위에서만 붙으므로 로컬에서는 "저장: 로컬"이다. S5 배포 후 확인.
- `server/src/server.ts`의 컬렉션 이름이 `lure_saves`로 박혀 있다. 게임마다 V8 프로젝트(=DB)가 따로라 당장 문제는 없지만,
  **S5의 `prepare-deploy.sh`가 게임별 이름으로 치환**해야 한다. Lure는 이미 배포돼 있으므로 `lure_saves`를 그대로 유지할 것(바꾸면 기존 클라우드 세이브가 끊긴다).


---

## 11. S5 결과 (2026-09-09) — 배포본 생성·하위경로 검증

`deploy/` 가 **게임별 폴더**가 됐다: `deploy/lure/`(17MB) · `deploy/soltys/`(19MB). 각각이 V8 프로젝트 하나에 대응한다.

    npm run deploy:prepare -- soltys
    cd deploy/soltys && npm install --legacy-peer-deps && npm run build && cd ../..
    npm run deploy:serve -- soltys          # http://localhost:3057/g/soltys/

`prepare-deploy.sh <game>`가 게임별로 하는 일:
- **그 게임의 엔진 데이터·번역·힌트만** 담는다(다른 게임 것은 넣지 않는다)
- `.env.production` 에 `VITE_GAME=<game>` → **`?game=` 없이 열어도 맞는 게임**이 뜬다(실측)
- `server/src/server.ts` 의 클라우드 세이브 컬렉션명을 게임별로 치환(`soltys_saves`).
  ⚠️ **이미 배포된 게임의 이름은 바꾸지 말 것** — 기존 클라우드 세이브가 끊긴다(lure는 `lure_saves` 유지)
- `docs/store/<game>{,-short}.md` 동봉

### 검증
- 하위경로 `/g/soltys/` 에서 index·wasm·ko.json·hints.json·vol.dat 전부 200, `--lang=ko` 스모크 통과(말풍선·상태줄·메뉴 한글).
- Lure도 `deploy/lure/` 로 다시 만들어 `/g/lure/` 에서 기존 전용 스모크 통과 — 배포 구조 변경이 이미 나간 게임을 깨지 않았다.
- 두 번들 모두 `"@agent8/gameserver"` bare specifier 0건, index.html에 절대경로 0건.
- 원스토어 요건은 셸 공통이라 그대로 따라온다: 광고 `timeoutMs: 120_000` 3곳, `server/src/*.ts`, viewport, 한/영 셸 UI.
  (검수기 `check.py`는 이 머신에 없어 **실행하지 못했다** — push 전에 `hakyong-tae/anything` v8-checker로 한 번 돌릴 것.)

### 남은 일
1. **Soltys용 V8 프로젝트 생성** → `SOLTYS_REPO=… bash tools/push-verse8.sh <토큰> soltys "…"`
2. 배포 후 **클라우드 세이브 왕복**과 실광고 확인(로컬에서는 agent8이 안 붙어 "저장: 로컬")
3. **한글 감수** — LLM 초벌이다. 실플레이하며 말투·오역, 특히 말장난 3곳 재검토
4. 원스토어 폼 답안에 Soltys 항목 추가(`docs/ONESTORE-FORM.md`는 아직 Lure 기준)

### 함정
- `prepare-deploy.sh` 는 `rm -rf deploy/<game>` 부터 한다 → **`npm install && npm run build` 는 prepare 다음에** 해야 한다.
  순서를 바꾸면 방금 만든 `dist/`가 지워진다(한 번 당함).
- `serve-subpath.mjs` 기본 포트를 3047 → **3057**로 옮겼다. 3047은 이 머신의 다른 프로젝트(scar-flame)가 쓴다.


---

## 12. 배포 사고와 수정 (2026-09-09) — Soltys 배포본이 Lure로 떴다

**증상**: V8에 올린 Soltys 프로젝트의 첫 화면이 `Lure of the Temptress` 타이틀·부제로 떴다.

**원인**: 배포본의 게임 지정을 `.env.production`(`VITE_GAME=soltys`) 하나에만 맡겼다.
파일은 정상 커밋돼 있었지만(클론해서 `git ls-files`로 확인), **V8 빌더가 production 모드로 돌지 않으면 Vite가 이 파일을 읽지 않는다.**
그러면 `GAME`이 기본값 `lure`로 떨어지고, index.html의 정적 문구까지 Lure로 하드코딩돼 있어 완전히 Lure 화면이 된다.

**수정**
- `index.html`에 **`<meta name="svm-game" content="…">`** 를 두고 `prepare-deploy.sh`가 게임별로 박는다.
  `config.ts`의 해석 순서: `?game=` → **meta** → `VITE_GAME` → `lure`. `.env.production`은 보조로 남긴다.
- index.html의 정적 문구에서 게임 이름을 뺐다(`#title`·`#subtitle`·promo는 비우고 JS가 채운다).
  하드코딩돼 있으면 선택이 어긋났을 때 다른 게임 제목이 그대로 보여 원인을 가린다.
- 부팅 시 `console.log('[shell] game =', GAME.id)` — 배포본이 어느 게임으로 떴는지 콘솔에서 즉시 확인.

**검증**: `deploy/soltys`에서 `.env.production`을 **지우고** 빌드해도 `[shell] game = soltys`, 제목 `Sołtys (한글판)`,
조작 안내까지 Soltys 것으로 나온다. 하위경로 한글 스모크도 통과.

**교훈**: 플랫폼 빌드의 모드·환경변수 적용 여부는 신뢰하지 말 것. 배포본이 자기 정체를 아는 방법은
**빌드 산출물 안에 들어가는 것**(HTML meta)이어야 한다. 그리고 정적 폴백 문구는 틀린 정보를 담지 말아야 한다.
