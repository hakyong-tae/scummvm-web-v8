# Lure of the Temptress 웹판 — M4(V8 통합) + M5(배포 준비) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 터치(트랙패드 모드), agent8 클라우드 세이브, `@verse8/ads` 인터스티셜(시작·종료 1회), 라이선스 고지 화면, 타이틀 화면을 붙이고, Verse8 하위경로 호스팅에서 그대로 동작하는 **배포 폴더(`deploy/`)** 를 만들어 GitLab `develop` push 직전 상태까지 간다. 실제 push는 사용자의 GitLab 토큰이 필요하므로 마지막에 요청한다.

**Architecture:** 셸(`src/`)만 바뀐다. 엔진 패치 없음. 터치는 캔버스 위 투명 오버레이가 포인터 이벤트를 받아 **합성 MouseEvent를 캔버스에 디스패치**(SDL3 Emscripten은 `isTrusted`를 보지 않음). 클라우드 세이브는 Emscripten 전역 `FS`로 `/home/web_user/saves`를 5초 폴링해 변경 파일을 base64로 agent8 컬렉션 `lure_saves`에 upsert, 부팅 직후 역방향 복원(mtime 비교·확인 프롬프트). 광고·게임서버는 Verse8 호스트 밖에서는 조용히 폴백. 배포는 `tools/prepare-deploy.sh`가 심볼릭 링크를 실파일로 풀어 `deploy/`를 만들고, 그 안의 `package.json`은 V8 빌더용(`vite build`만, emscripten 스크립트 없음).

**Tech Stack:** 기존 + `@agent8/gameserver@^1.10`(`--legacy-peer-deps`), `@verse8/ads@^0.4`.

**게임 제목(확정):** `Lure of the Temptress (한글판)` — `src/config.ts`의 `GAME_TITLE` 한 곳. 부제 `유혹의 마녀`.

**사전 확인된 사실:**
- 빌드 산출 `scummvm.js`는 비-MODULARIZE라 `FS`, `IDBFS`, `Module`이 **전역**. IDBFS는 엔진이 `HOME=/home/web_user`에 `autoPersist:true`로 마운트(쓰기마다 자동 IndexedDB 동기화). `scummvm.ini`의 `savepath=/home/web_user/saves`.
- agent8: 접속은 **스토어 경유**(`@agent8/gameserver/dist/src/store/useGameServerStore` 리터럴 딥임포트, `GameServer.connect()` 직접 호출 금지), 호출은 `GameServer.getInstance().remoteFunction(name, args)`. 서버는 **루트 `server.js`의 export 없는 `class Server`**, `$global.getCollectionItems(id, {filters,limit})` / `addCollectionItem(id, item)` / `updateCollectionItem(id, item)`(2인자, `item.__id`) / `deleteCollectionItem(id, __id)`, `$sender.account`.
- `@verse8/ads`: **정적 import**, `Verse8Ads.showInterstitial({placementId})`, 호스트 밖이면 `unsupported_env` → 로컬은 mock. `ads-verifier` 직접 호출 금지.
- Verse8 iframe 호스팅: `index.html`에 `GAME_SIZE_RESPONSE` 핸드셰이크 필수, `vite.config base:'./'`, 하위경로라 절대경로 금지. 배포 브랜치 `develop`, 빌더는 `bun install && bun run build`(→ `dist/` 정적 호스팅), `package-lock.json` 금지, 플랫폼 `.env` 보존. 외부 push는 V8 워크스페이스에 자동반영 안 됨 → V8 AI 프롬프트로 `git fetch && git reset --hard origin/develop`.
- 현재 `npm run build` → `dist/` 42MB(engine 27MB: 테마 zip·doc·png·scummvm.html 포함). `public/engine`·`public/games/lure`는 심볼릭 링크(Vite는 따라가서 복사함).
- 절대경로 3곳: `index.html` `/fonts/neodgm.woff2`, `src/main.ts` `/games/lure/strings.en.json`·`/games/lure/ko.json`.
- Lure 우클릭 팝업은 **버튼을 누른 동안** 표시, 놓으면 선택 실행 → 트랙패드 롱프레스=우버튼 다운, 드래그=선택, 놓기=실행이 원작과 정확히 대응.

---

## File Structure

```
src/
├── config.ts              # GAME_TITLE, SUBTITLE, placementId, 컬렉션 이름, 폴링 주기
├── main.ts                # 타이틀 화면 배선(시작→광고→부팅), 설정 패널, 고지 모달, 종료 처리
├── engine/loader.ts       # onExit 콜백 추가
├── input/trackpad.ts      # 포인터→합성 MouseEvent (트랙패드/직접탭), 순수 상태머신 + DOM 어댑터
├── verse8/gameserver.ts   # 스토어 경유 접속 + callServer (server-survival 패턴 이식)
├── verse8/ads.ts          # showInterstitial 래퍼 + 로컬 mock
├── save/fsSaves.ts        # FS 읽기/쓰기/목록/폴링 (전역 FS 의존, 인터페이스로 주입)
├── save/cloudSync.ts      # 로컬↔클라우드 diff·업로드·복원 결정 (순수 함수 + 서비스 주입)
└── ui/notice.ts           # 고지 모달(LICENSE/README 전문 fetch, GPL·OFL·비공식 자막 고지)
server.js                  # agent8: listSaves/getSave/putSave/deleteSave
index.html                 # GAME_SIZE 핸드셰이크, 타이틀 화면 DOM, 상대경로
vite.config.ts             # base './'
tools/prepare-deploy.sh    # deploy/ 생성(심볼릭 해제·엔진 트림·V8용 package.json)
tools/serve-subpath.mjs    # dist를 /g/lure/ 하위경로로 서빙(검증용)
docs/DEPLOY-VERSE8.md  docs/STORE.md
tests/trackpad.test.ts  tests/cloudSync.test.ts
```

---

### Task 1: 절대경로 제거 + base './' + GAME_SIZE 핸드셰이크 + config.ts

- [ ] `src/config.ts`
```ts
export const GAME_TITLE = 'Lure of the Temptress (한글판)'
export const GAME_SUBTITLE = '유혹의 마녀 · 1992 Revolution Software'
export const AD_PLACEMENT_START = 'lure-start'
export const AD_PLACEMENT_QUIT = 'lure-quit'
export const SAVE_COLLECTION = 'lure_saves'
export const SAVE_DIR = '/home/web_user/saves'
export const SAVE_POLL_MS = 5000
export const SAVE_MAX_BYTES = 512 * 1024
/** 하위경로 호스팅 안전 URL */
export const assetUrl = (rel: string) => new URL(rel, document.baseURI).href
```
- [ ] `index.html`: `@font-face url('fonts/neodgm.woff2')`(상대), `<title>` = GAME_TITLE 문자열, `<head>`에 server-survival과 동일한 GAME_SIZE 핸드셰이크 인라인 스크립트, viewport `user-scalable=no, viewport-fit=cover`.
- [ ] `src/main.ts`: `fetch(assetUrl('games/lure/strings.en.json'))`, `ko.json` 동일.
- [ ] `vite.config.ts`: `base: './'`.
- [ ] 검증: `npm run build` 후 `grep -rn '"/fonts\|"/games' dist/index.html dist/assets/*.js` → 0건. Commit.

### Task 2: 트랙패드 입력 (TDD)

- [ ] `tests/trackpad.test.ts` — 순수 상태머신 `TrackpadFSM`: 입력 `down(x,y,t)` `move(x,y,t)` `up(t)`, 출력 액션 배열 `{type:'move', dx, dy} | {type:'click', button:0} | {type:'rdown'} | {type:'rup'}`.
  - 탭(≤250ms, 이동<8px) → `[click 0]`
  - 드래그 → `move` 델타들(1:1)
  - 롱프레스(≥400ms 정지) → `rdown`, 이후 move는 `move`, up → `rup`
  - 직접탭 모드: down 즉시 `{type:'warp', x, y}` 후 up에 `click`
- [ ] `src/input/trackpad.ts`: FSM + `attachTrackpad(overlay, canvas, opts)` 어댑터 — 가상 커서 좌표를 유지하고 `canvas.dispatchEvent(new MouseEvent('mousemove'|'mousedown'|'mouseup', {clientX, clientY, button, buttons, bubbles:true}))`. 롱프레스는 `setTimeout(400)`로 감지. `pointer: coarse`일 때만 오버레이 활성(`?touch=1`로 강제).
- [ ] **합성 MouseEvent가 SDL에 먹는지 실측**(가장 큰 리스크): `tools/smoke.mjs`에 `--touch` 옵션 — puppeteer `page.touchscreen`으로 캔버스 위 탭/롱프레스/드래그를 넣고, 레코드에 상태줄·팝업이 나타나는지 확인. 안 먹으면 대안 = SDL 대신 우리 오버레이가 좌표를 Emscripten `Module['SDL3']`… 대신 **엔진 패치 04로 `Module.lureInjectMouse(x,y,buttons)` 훅**(`EmscriptenSdlEventSource`에 이벤트 큐 주입) — 플랜 B로 명시.
- [ ] `fitCanvas`: 정수배 → **contain 비율(소수)**. 세로 화면이면 `#rotateHint` 오버레이.
- [ ] Commit.

### Task 3: agent8 클라우드 세이브

- [ ] `server.js`(루트):
```js
const SAVES = "lure_saves"; const MAX_BYTES = 512 * 1024;
class Server {
  async ping() { return "pong"; }
  async listSaves() {
    const items = await $global.getCollectionItems(SAVES, { filters: [{ field: "account", operator: "==", value: $sender.account }], limit: 100 });
    return items.map(i => ({ slot: i.slot, name: i.name, mtime: i.mtime, size: i.size }));
  }
  async getSave(slot) {
    const items = await $global.getCollectionItems(SAVES, { filters: [{ field: "account", operator: "==", value: $sender.account }, { field: "slot", operator: "==", value: String(slot) }], limit: 1 });
    return items[0] ? { slot: items[0].slot, name: items[0].name, mtime: items[0].mtime, data: items[0].data } : null;
  }
  async putSave(slot, name, mtime, data) {
    if (typeof data !== "string" || data.length > MAX_BYTES * 1.4) throw new Error("save too large");
    const item = { account: $sender.account, slot: String(slot), name: String(name || slot).slice(0, 64), mtime: Number(mtime) || Date.now(), size: Math.floor(data.length * 0.75), data };
    const existing = await $global.getCollectionItems(SAVES, { filters: [{ field: "account", operator: "==", value: $sender.account }, { field: "slot", operator: "==", value: item.slot }], limit: 1 });
    if (existing[0]) { await $global.updateCollectionItem(SAVES, { ...item, __id: existing[0].__id }); return { updated: true }; }
    await $global.addCollectionItem(SAVES, item); return { updated: false };
  }
  async deleteSave(slot) {
    const existing = await $global.getCollectionItems(SAVES, { filters: [{ field: "account", operator: "==", value: $sender.account }, { field: "slot", operator: "==", value: String(slot) }], limit: 10 });
    for (const e of existing) await $global.deleteCollectionItem(SAVES, e.__id);
    return { deleted: existing.length };
  }
}
```
- [ ] `src/verse8/gameserver.ts`: server-survival `gameserver.js` 이식(ensureConnected 스토어 경유·단일 비행·예산·callServer). `VITE_AGENT8_VERSE` 없으면 즉시 offline.
- [ ] `src/save/fsSaves.ts`: `interface SaveFS { readdir(p):string[]; readFile(p):Uint8Array; writeFile(p,d):void; stat(p):{mtime:Date,size:number}; mkdirp(p):void; sync():Promise<void> }` + 전역 `FS` 어댑터(`FS.syncfs(false, cb)`). `snapshot(dir)` → `{[file]: {mtime, size}}`.
- [ ] `tests/cloudSync.test.ts` + `src/save/cloudSync.ts`(순수): `diffSaves(localSnap, cloudList)` → `{upload: slot[], download: slot[], conflict: slot[]}` (mtime 기준, 5초 오차 허용; 크기·mtime 동일=skip). `planRestore(conflicts, userChoice)`.
- [ ] `src/save/syncController.ts`: 부팅 후 3초 → `listSaves` → diff → download(확인 프롬프트는 conflict만: "다른 기기의 세이브가 더 최신입니다. 불러올까요?") → 폴링 5초마다 snapshot 비교 → 변경 파일 base64 업로드(`btoa` 청크). 상태 배지 `#cloud`: 동기화됨/오프라인/업로드 중.
- [ ] 검증: 로컬은 offline 폴백 로그, 단위 테스트 green. 실 왕복은 V8 배포 후. Commit.

### Task 4: 광고 + 타이틀 화면 + 종료 처리

- [ ] `src/verse8/ads.ts`: server-survival `ads.js` 이식(정적 import, `showInterstitialWithTimeout(placementId, 8000)`, 호스트 밖 mock = 1.5초 가짜 배너).
- [ ] 타이틀 화면(`index.html #start` 확장): 제목·부제, [게임 시작] [언어 한/영] [정보], 클라우드 배지. 시작 → 인터스티셜(`lure-start`) → 부팅.
- [ ] 종료: `Module.onExit`/`quit` 콜백(loader에 `onExit` 추가, `noExitRuntime` 기본 false라 ScummVM Quit 시 런타임 종료) → 인터스티셜(`lure-quit`) → "다시 시작" 화면(location.reload).
- [ ] Commit.

### Task 5: 고지 화면 `src/ui/notice.ts`

- [ ] 모달: ① 원작 저작권 "© 1992 Revolution Software Ltd. Freeware", ② `engine/data/games/lure/LICENSE.txt`·`README` 전문 fetch 표시, ③ "비공식 한글 자막 — 원본 게임 데이터는 개조하지 않았습니다", ④ ScummVM GPLv3 + 소스(`VITE_SOURCE_URL`, 미설정 시 "배포본 engine-patches/ 참조"), ⑤ Neo둥근모 SIL OFL 1.1. 타이틀 [정보] 버튼과 인게임 우상단 ⓘ.
- [ ] Commit.

### Task 6: 배포 준비 (M5)

- [ ] `tools/prepare-deploy.sh`: `deploy/` 재생성 — `index.html vite.config.ts tsconfig.json src/ server.js games/lure/*.json engine-patches/ NOTES.md docs/` 복사, `public/` **실파일**(engine: `scummvm.js scummvm.wasm data/` 만 — `scummvm.html doc/ *.png manifest.json logo.svg favicon.ico` 제외; `data/`에서 `residualvm.zip scummremastered.zip scummclassic.zip helpdialog.zip translations.dat achievements.dat classicmacfonts.dat encoding.dat macgui.dat` 제외 후 `index.json` 재생성), `fonts/`, `games/lure/*.json` 복사; `package.json`은 V8용(scripts: dev/build/preview만, deps `@agent8/gameserver` `@verse8/ads`, devDeps vite/typescript), `.gitignore`(node_modules dist), `package-lock.json` 없음.
- [ ] `tools/serve-subpath.mjs`: `deploy/dist`를 `http://localhost:3047/g/lure/`로 서빙(node http, 정확한 MIME: wasm/json/woff2).
- [ ] 검증: `cd deploy && npm install --legacy-peer-deps && npm run build` → `node tools/serve-subpath.mjs` → `node tools/smoke.mjs --lang=ko http://localhost:3047/g/lure/` **SMOKE OK**(하위경로에서 엔진·데이터·폰트·ko.json 전부 200). 빌드 `"@agent8/gameserver"` 문자열 0건 확인(`grep -c` on dist/assets/*.js).
- [ ] `docs/DEPLOY-VERSE8.md`(절차 + V8 AI 프롬프트) · `docs/STORE.md`(제목·설명 ko/en·태그·스크린샷 목록). 사용자에게 GitLab 토큰/repo 요청으로 종료.

## Self-Review
- 스펙 §4.4(세이브 동기화·충돌) T3 ✓ §4.5(트랙패드·가로 안내) T2 ✓ §2(광고 최소·고지) T4·T5 ✓ §3 하위경로 T1·T6 ✓. 실 push는 토큰 필요 → 명시적으로 사용자 입력 대기.
- 리스크: 합성 MouseEvent가 SDL3에 안 먹을 가능성 → T2에 플랜 B. Emscripten 종료 콜백 이름(`onExit` vs `quit`) 실측 필요 → T4에서 확인.
