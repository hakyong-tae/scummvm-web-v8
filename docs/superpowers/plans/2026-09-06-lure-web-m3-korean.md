# Lure of the Temptress 웹판 — M3 한글 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 엔진의 모든 대사·설명·이름·액션 단어를 전수 덤프하고, 외부 `ko.json`으로 한글을 공급해 DOM 텍스트 레이어가 영문 블록을 한글 블록(재줄바꿈·조사 처리)으로 바꿔 그린다. 완료 판정 = 첫 방(감옥)에서 상태줄·동사 팝업·설명 대화창·NPC 대화가 한글로 표시되고 `i18n-check` 오류 0.

**Architecture:** 원본 데이터 무개조 유지. 엔진 패치 01을 확장해 (a) `StringData::getString` 훅이 `(table, localId, 영문최종, hotspotName, charName)`을 보고하고 (b) `Module.lureDumpRequest`가 설정되면 `present()`에서 3개 문자열 테이블 + `StringList`를 전수 디코드해 `Module.onLureDump(json)`로 넘긴다(Asyncify 중 JS→wasm 호출이 불가하므로 엔진 쪽에서 폴링). JS는 `(table:local)` 키로 한글 템플릿을 찾아 이름·조사를 치환해 **영문최종 → 한글최종** 런타임 맵을 만들고, 레이어는 레코드를 블록(연속 줄)으로 묶어 영문을 재조립·정규화해 맵에서 한글을 찾은 뒤 블록 폭에 맞춰 재줄바꿈해 그린다. 상태줄은 `StringList` 액션 + 이름 연결이라 액션별 한글 템플릿으로 별도 합성.

**Tech Stack:** M0~M2와 동일 + Puppeteer(덤프/스모크, `cryzen-downloader/node_modules/puppeteer`).

**사전 확인된 사실:**
- `StringData::initPosition`: `stringId &= 0x1fff` 후 **방 번호 ≥0x2A면 0x7d0~0xfa0 구간이, <0x2A면 ≥0xfa0 구간이 `0x76`으로 대체**됨. 테이블 = 0(id<0x7d0) / 1(<0xfa0, local=id-0x7d0) / 2(local=id-0xfa0). 테이블 헤더: `[0..1]`=문자열별 1바이트 크기표 오프셋, `[2..3]`=비트데이터 오프셋 → **문자열 수 = READ_LE_UINT16(tbl+2) − READ_LE_UINT16(tbl)**.
- `getString`은 `%1`→hotspotName, `%2`→characterName(관사는 `includeArticles`일 때 `stringList().getString(S_ARTICLE_LIST+article-1)` 접두), `≥0xa0` 바이트는 `getName()` 단어 조각. `dest`는 무제한 쓰기(MAX_DESC_SIZE 1024).
- `StringList`(lure.dat 0x3f17): `count()`, `getString(int)`. Action enum은 index+1. `S_FOR=35`(" for "), `S_TO=36`, `S_ON=37`, `S_ARTICLE_LIST=46`.
- 상태줄 조립(game.cpp): `"%s " % stringList.getString(action)` + `getString(hotspot->nameId)` (+ `S_FOR/S_TO/S_ON` + 이름). 좌클릭은 `LOOK_AT + " " + 이름`.
- 줄바꿈 `Surface::wordWrap`: 공백/`\n`에서만 분리 → 줄을 `' '`로 join하고 공백 정규화하면 원문과 일치.
- TalkDialog: 이름 헤더는 가운데 정렬(별도 x), 본문 줄은 `TALK_DIALOG_EDGE_SIZE+2`에서 시작, 타이프라이터로 마지막 줄이 `len`만큼 부분 표시.
- 설명 대화창 `INFO_DIALOG_WIDTH` 고정, 줄 피치 7px(squashed); TalkDialog 피치 8px.

---

## File Structure

```
engine-patches/01-lure-text-hooks.patch   # 확장: strings.h/.cpp(getStringRaw·resolveTable), webtext(dumpAll·notifyString 5인자)
games/lure/
├── strings.en.json      # 덤프: {list:[…], tables:[[…],[…],[…]]}  플레이스홀더 {hotspot}/{char}  (커밋)
├── glossary.json        # 고유명사 표기 {"Diermot":"디어모트",…}
├── ko.json              # {"list":{"<i>":"…"}, "t":{"<table>:<local>":"…"}}  템플릿 {hotspot:을} {char:이}
src/i18n/josa.ts         # 받침 기반 조사 (순수)
src/i18n/dict.ts         # ko.json 로딩·키·이름 역조회·템플릿 치환 → 영문최종→한글최종 맵
src/i18n/status.ts       # 상태줄 합성 (액션 템플릿)
src/text/blocks.ts       # 레코드 → 블록(연속 줄) + 영문 재조립·정규화·prefix 매칭
src/text/kolayout.ts     # 한글 재줄바꿈·폰트 크기 선택 (measure 주입)
src/text/layer.ts        # 블록 렌더 경로 추가
src/main.ts              # ?lang=ko|en, ko.json fetch, onString 배선
tools/dump-strings.mjs   # 덤프 실행 → strings.en.json
tools/i18n-check.mjs     # 커버리지·플레이스홀더·용어집·길이 검사
tests/josa.test.ts dict.test.ts status.test.ts blocks.test.ts kolayout.test.ts
```

---

### Task 1: 엔진 훅 확장 — 테이블 해석·덤프

**Files (engine/scummvm, 패치 01 재생성):**
- Modify: `engines/lure/strings.h`(public 메서드 2개), `engines/lure/strings.cpp`(resolveTable 추출, getStringRaw, notify 5인자), `engines/lure/webtext.h/.cpp`(notifyString 시그니처, dumpAll)
- 스크립트: `scratchpad/hooks/apply_hooks.py`에 아래 편집 추가(M0~M2 편집 위에 누적)

- [ ] **Step 1: strings.h** — `class StringData` public에 추가
```cpp
	// scummvm-web-v8: which table/local index a (room-dependent) stringId resolves to
	static void resolveTable(uint16 stringId, int &table, uint16 &localId);
	// scummvm-web-v8: decode a string directly from a table, no room remap, names as placeholders
	bool getStringRaw(int table, uint16 localId, char *dest, const char *hotspotName, const char *characterName);
	int tableStringCount(int table);
```

- [ ] **Step 2: strings.cpp** — `initPosition` 앞부분(방 번호 리맵 + 테이블 선택)을 `resolveTable`로 추출하고, 위치 계산을 `initPositionInTable(localId)`로 분리. 기존 `initPosition(stringId)`는 두 함수를 호출하도록 유지(동작 불변).
```cpp
void StringData::resolveTable(uint16 stringId, int &table, uint16 &localId) {
	uint16 roomNumber = Room::getReference().roomNumber();
	if ((roomNumber >= 0x2A) && (stringId >= STRING_ID_RANGE) && (stringId < STRING_ID_UPPER))
		stringId = 0x76;
	if ((roomNumber < 0x2A) && (stringId >= STRING_ID_UPPER))
		stringId = 0x76;
	if (stringId < STRING_ID_RANGE) { table = 0; localId = stringId; }
	else if (stringId < STRING_ID_RANGE * 2) { table = 1; localId = stringId - STRING_ID_RANGE; }
	else { table = 2; localId = stringId - STRING_ID_RANGE * 2; }
}

int StringData::tableStringCount(int table) {
	const byte *tbl = _strings[table]->data();
	return READ_LE_UINT16(tbl + 2) - READ_LE_UINT16(tbl);
}
```
`initPosition`은 `resolveTable(stringId, table, local); _stringTable = _strings[table]->data(); stringId = local;` 이후 기존 코드 그대로. `getStringRaw`는 `getString`의 디코딩 루프를 복제하되 `initPosition` 대신 `_stringTable = _strings[table]->data(); stringId = localId;` + 위치 계산, 관사 없이 `%1`→hotspotName, `%2`→characterName 치환, `localId >= tableStringCount(table)`이면 `dest[0]='\0'; return false`.
`getString` 끝: `int t; uint16 l; resolveTable(stringId, t, l); WebText::notifyString(t, l, dest, hotspotName, characterName);`

- [ ] **Step 3: webtext.h/.cpp**
```cpp
void notifyString(int table, uint16 localId, const char *text, const char *hotspotName, const char *characterName);
```
JS: `Module['onLureString'](table, localId, UTF8ToString(text), UTF8ToString(hotspot), UTF8ToString(character))` (null이면 "").
`present()` 첫 줄에 `maybeDump();` 추가:
```cpp
static void maybeDump() {
	if (!EM_ASM_INT({ return Module['lureDumpRequest'] ? 1 : 0; })) return;
	EM_ASM({ Module['lureDumpRequest'] = 0; });
	StringData &sd = StringData::getReference();
	StringList &sl = Resources::getReference().stringList();
	static char buf[MAX_DESC_SIZE * 2];
	Common::String json = "{\"list\":[";
	for (int i = 0; i < sl.count(); ++i) { if (i) json += ','; appendJsonString(json, Common::String(sl.getString(i))); }
	json += "],\"tables\":[";
	for (int t = 0; t < 3; ++t) {
		if (t) json += ',';
		json += '[';
		int n = sd.tableStringCount(t);
		for (int i = 0; i < n; ++i) {
			if (i) json += ',';
			buf[0] = '\0';
			sd.getStringRaw(t, (uint16)i, buf, "\x01", "\x02");
			appendJsonString(json, Common::String(buf));
		}
		json += ']';
	}
	json += "]}";
	EM_ASM({ if (Module['onLureDump']) Module['onLureDump'](UTF8ToString($0)); }, json.c_str());
}
```
`appendJsonString`의 `c < 0x20` 분기를 `\x01`→`{hotspot}`, `\x02`→`{char}`, `\n`→`\\n`, 그 외 공백으로 바꾼다.

- [ ] **Step 4: 패치 재생성 + 빌드 + 스테이징** (`python3 scratchpad/hooks/apply_hooks.py` → `git add -N` → `git diff -- engines/lure > engine-patches/01-lure-text-hooks.patch` → `npm run engine:build` → `npm run data:stage`). Expected: 컴파일 오류 0, `scummvm.wasm` 갱신.

- [ ] **Step 5: 브라우저/헤드리스에서 `onLureString` 5인자 확인** — smoke 실행 후 콘솔에 `[lure-str] 0:118 "Cell door"` 형식 로그(임시 `onString` 로거). Commit.

---

### Task 2: 덤프 도구 `tools/dump-strings.mjs`

- [ ] **Step 1: 스크립트** — 부팅 → 첫 방 진입 직후 `window.Module.lureDumpRequest = 1` → `window.__dump` 수신 대기 → 파싱 → `games/lure/strings.en.json` 저장. 테이블 1·2는 방 번호와 무관하게 raw로 읽으므로 첫 방에서 한 번이면 전수.
```js
import { createRequire } from 'node:module'; import { writeFileSync } from 'node:fs'
const require = createRequire('/Users/hytae/Downloads/cryzen-downloader/package.json'); const puppeteer = require('puppeteer')
const base = process.argv[2] || 'http://localhost:3046/'; const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 900 })
await page.evaluateOnNewDocument(() => { window.__dump = null })
await page.goto(base + '?layer=0', { waitUntil: 'load' }); await page.click('#startBtn')
await page.waitForFunction(() => window.Module && window.Module.onLureText, { timeout: 60000 })
await page.evaluate(() => { window.Module.onLureDump = j => { window.__dump = j } })
await sleep(15000); await page.mouse.click(700, 450); await sleep(2500); await page.keyboard.press('Escape'); await sleep(2500); await page.keyboard.press('Escape'); await sleep(3000)
await page.evaluate(() => { window.Module.lureDumpRequest = 1 })
await page.mouse.move(600, 400); await sleep(500); await page.mouse.move(650, 420)   // present() 유발
await page.waitForFunction(() => window.__dump !== null, { timeout: 30000 })
const dump = JSON.parse(await page.evaluate(() => window.__dump))
const out = { list: dump.list, tables: dump.tables, counts: dump.tables.map(t => t.length), listCount: dump.list.length }
writeFileSync(new URL('../games/lure/strings.en.json', import.meta.url), JSON.stringify(out, null, 1))
console.log('list', out.listCount, 'tables', out.counts, 'total', out.counts.reduce((a, b) => a + b, 0))
await browser.close()
```
- [ ] **Step 2: 실행 + 검증** — `node tools/dump-strings.mjs` → 테이블별 개수 출력. `strings.en.json`에서 `"Cell door"`, `"Look at"`(list), `{hotspot}` 포함 문자열이 존재하는지 grep. 빈 문자열/깨진 문자열 비율 확인(`tables[t]`의 빈 항목 수 < 5%).
- [ ] **Step 3: Commit** (`strings.en.json` 커밋 — 원문은 라이선스상 배포 가능)

---

### Task 3: 조사 엔진 `src/i18n/josa.ts` (TDD)

- [ ] **Step 1: 테스트 `tests/josa.test.ts`**
```ts
import { describe, it, expect } from 'vitest'
import { hasBatchim, josa, applyTemplate } from '../src/i18n/josa'
describe('josa', () => {
  it('detects batchim', () => { expect(hasBatchim('문')).toBe(true); expect(hasBatchim('창문')).toBe(true); expect(hasBatchim('열쇠')).toBe(false) })
  it('picks particle pair', () => {
    expect(josa('창문', '을')).toBe('창문을'); expect(josa('열쇠', '을')).toBe('열쇠를')
    expect(josa('문', '은')).toBe('문은'); expect(josa('열쇠', '은')).toBe('열쇠는')
    expect(josa('문', '이')).toBe('문이'); expect(josa('열쇠', '이')).toBe('열쇠가')
    expect(josa('문', '과')).toBe('문과'); expect(josa('열쇠', '과')).toBe('열쇠와')
    expect(josa('집', '으로')).toBe('집으로'); expect(josa('물', '으로')).toBe('물로'); expect(josa('바다', '으로')).toBe('바다로')
  })
  it('falls back for non-hangul (treat consonant-ending latin as batchim)', () => {
    expect(josa('Skorl', '을')).toBe('Skorl을'); expect(josa('Selena', '을')).toBe('Selena를')
  })
  it('fills template with names and particles', () => {
    expect(applyTemplate('{char}이 {hotspot:을} 살펴본다', { hotspot: '열쇠', char: '디어모트' })).toBe('디어모트가 열쇠를 살펴본다')
    expect(applyTemplate('{hotspot}', { hotspot: '문' })).toBe('문')
    expect(applyTemplate('그냥 텍스트', {})).toBe('그냥 텍스트')
  })
})
```
- [ ] **Step 2: 실패 확인** → **Step 3: 구현**
```ts
const PAIRS: Record<string, [string, string]> = { '을': ['을', '를'], '는': ['은', '는'], '은': ['은', '는'], '이': ['이', '가'], '가': ['이', '가'],
  '과': ['과', '와'], '와': ['과', '와'], '으로': ['으로', '로'], '로': ['으로', '로'], '아': ['아', '야'], '야': ['아', '야'], '를': ['을', '를'] }
export function hasBatchim(word: string): boolean {
  const ch = word.trimEnd().slice(-1); const code = ch.codePointAt(0) ?? 0
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0
  if (/[a-z]/i.test(ch)) return !/[aeiouy]/i.test(ch)   // 영문 이름 폴백: 자음 끝 = 받침
  if (/[0-9]/.test(ch)) return '013678'.includes(ch)
  return false
}
function endsWithRieul(word: string): boolean { const code = word.trimEnd().slice(-1).codePointAt(0) ?? 0; return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8 }
export function josa(word: string, particle: string): string {
  const pair = PAIRS[particle]; if (!pair) return word + particle
  if (pair[0] === '으로') return word + (hasBatchim(word) && !endsWithRieul(word) ? '으로' : '로')
  return word + (hasBatchim(word) ? pair[0] : pair[1])
}
/** "{hotspot:을}" / "{char}" 치환 */
export function applyTemplate(tpl: string, names: { hotspot?: string; char?: string }): string {
  return tpl.replace(/\{(hotspot|char)(?::([^}]+))?\}/g, (_, k: 'hotspot' | 'char', p?: string) => { const n = names[k] ?? ''; return p ? josa(n, p) : n })
}
```
- [ ] **Step 4: 통과 → Commit**

---

### Task 4: 사전·런타임 맵 `src/i18n/dict.ts` (TDD)

- [ ] **Step 1: 테스트 `tests/dict.test.ts`**
```ts
import { describe, it, expect } from 'vitest'
import { KoDict, normalizeEn } from '../src/i18n/dict'
const en = { list: ['Look at', 'Get', ' for '], tables: [['Cell door', 'The {hotspot} is locked.', 'Skorl'], [], []] }
const ko = { list: { '0': '{1} 보기', '1': '{1} 가져가기' }, t: { '0:0': '감옥 문', '0:1': '{hotspot:은} 잠겨 있다.', '0:2': '스콜' } }
describe('KoDict', () => {
  const d = new KoDict(en, ko)
  it('normalizes whitespace/newlines', () => { expect(normalizeEn('a  b\n\nc ')).toBe('a b c') })
  it('translates a plain string by table:local', () => { expect(d.template(0, 0)).toBe('감옥 문') })
  it('resolves english names to korean via reverse index', () => { expect(d.koName('Cell door')).toBe('감옥 문'); expect(d.koName('Unknown')).toBe('Unknown') })
  it('composes final korean and registers en→ko', () => {
    const out = d.onString(0, 1, 'The Cell door is locked.', 'Cell door', '')
    expect(out).toBe('감옥 문은 잠겨 있다.')
    expect(d.lookup('The Cell door is locked.')).toBe('감옥 문은 잠겨 있다.')
  })
  it('prefix lookup for typewriter partial text', () => {
    d.onString(0, 1, 'The Cell door is locked.', 'Cell door', '')
    const r = d.lookupPrefix('The Cell door is')
    expect(r?.full).toBe('감옥 문은 잠겨 있다.'); expect(r?.ratio).toBeCloseTo(16 / 24, 2)
  })
  it('returns null when no translation', () => { expect(d.onString(1, 5, 'x', '', '')).toBeNull(); expect(d.lookup('x')).toBeNull() })
})
```
- [ ] **Step 2: 실패 확인** → **Step 3: 구현**
```ts
import { applyTemplate } from './josa'
export interface EnDump { list: string[]; tables: string[][] }
export interface KoData { list: Record<string, string>; t: Record<string, string> }
export const normalizeEn = (s: string) => s.replace(/\s+/g, ' ').trim()
export class KoDict {
  private byEn = new Map<string, string>()          // 영문최종(정규화) → 한글최종
  private nameIndex = new Map<string, string>()     // 영문 이름(정규화) → 한글 (테이블 전수 역색인)
  constructor(private en: EnDump, private ko: KoData) {
    en.tables.forEach((tbl, t) => tbl.forEach((s, i) => { const k = ko.t[`${t}:${i}`]; if (k && !s.includes('{')) this.nameIndex.set(normalizeEn(s), k) }))
  }
  template(table: number, local: number): string | null { return this.ko.t[`${table}:${local}`] ?? null }
  listKo(index: number): string | null { return this.ko.list[String(index)] ?? null }
  koName(enName: string): string { return this.nameIndex.get(normalizeEn(enName)) ?? enName }
  /** 엔진 getString 훅: 한글최종을 만들고 등록. 번역 없으면 null */
  onString(table: number, local: number, enFinal: string, hotspot: string, char: string): string | null {
    const tpl = this.template(table, local); if (!tpl) return null
    const out = applyTemplate(tpl, { hotspot: hotspot ? this.koName(hotspot) : '', char: char ? this.koName(char) : '' })
    this.byEn.set(normalizeEn(enFinal), out); return out
  }
  lookup(enJoined: string): string | null { return this.byEn.get(normalizeEn(enJoined)) ?? null }
  /** 타이프라이터 부분 문자열: 등록된 영문 중 prefix 일치 → 한글 전체 + 진행 비율 */
  lookupPrefix(enPartial: string): { full: string; ratio: number } | null {
    const p = normalizeEn(enPartial); if (!p) return null
    for (const [en, ko] of this.byEn) if (en.startsWith(p) && en !== p) return { full: ko, ratio: p.length / en.length }
    return null
  }
}
```
- [ ] **Step 4: 통과 → Commit**

---

### Task 5: 상태줄 합성 `src/i18n/status.ts` (TDD)

상태줄 = `<action> <name>` 또는 `<action> <name><connector><name2>`(connector ∈ list[S_FOR=35], list[S_TO=36], list[S_ON=37]). 액션 한글은 `ko.list[i]` 템플릿 `{1}`, `{2}` 사용(예: `"Give"` → `"{2}에게 {1} 주기"`, `"Look at"` → `"{1} 보기"`).

- [ ] **Step 1: 테스트 `tests/status.test.ts`**
```ts
import { describe, it, expect } from 'vitest'
import { StatusComposer } from '../src/i18n/status'
import { KoDict } from '../src/i18n/dict'
const en = { list: ['Look at', 'Get', 'Give', ' to ', ' for '], tables: [['Cell door', 'Ratpouch', 'key'], [], []] }
const ko = { list: { '0': '{1} 보기', '1': '{1} 가져가기', '2': '{2}에게 {1} 주기' }, t: { '0:0': '감옥 문', '0:1': '랫파우치', '0:2': '열쇠' } }
describe('StatusComposer', () => {
  const sc = new StatusComposer(new KoDict(en, ko), en, ko, { to: 3, for: 4 })
  it('action + name', () => { expect(sc.compose('Look at Cell door')).toBe('감옥 문 보기') })
  it('action + name + connector + name', () => { expect(sc.compose('Give key to Ratpouch')).toBe('랫파우치에게 열쇠 주기') })
  it('unknown → null', () => { expect(sc.compose('Frobnicate thing')).toBeNull() })
  it('bare name passes through dictionary', () => { expect(sc.compose('Cell door')).toBe('감옥 문') })
})
```
- [ ] **Step 2: 실패 확인** → **Step 3: 구현**
```ts
import type { EnDump, KoData } from './dict'
import { KoDict, normalizeEn } from './dict'
export class StatusComposer {
  private actions: { en: string; idx: number }[]
  private connectors: { en: string; key: 'to' | 'for' | 'on' }[]
  constructor(private dict: KoDict, en: EnDump, private ko: KoData, conn: { to?: number; for?: number; on?: number }) {
    this.actions = en.list.map((s, idx) => ({ en: normalizeEn(s), idx })).filter(a => a.en && ko.list[String(a.idx)]).sort((a, b) => b.en.length - a.en.length)
    this.connectors = (['to', 'for', 'on'] as const).filter(k => conn[k] !== undefined).map(k => ({ en: normalizeEn(en.list[conn[k]!]), key: k }))
  }
  compose(line: string): string | null {
    const s = normalizeEn(line)
    const direct = this.dict.lookup(s) ?? (this.dict.koName(s) !== s ? this.dict.koName(s) : null)
    if (direct) return direct
    const act = this.actions.find(a => s === a.en || s.startsWith(a.en + ' ')); if (!act) return null
    const rest = s.slice(act.en.length).trim(); const tpl = this.ko.list[String(act.idx)]
    let n1 = rest, n2 = ''
    for (const c of this.connectors) { const i = rest.indexOf(` ${c.en} `); if (i > 0) { n1 = rest.slice(0, i); n2 = rest.slice(i + c.en.length + 2); break } }
    const k1 = n1 ? this.dict.koName(n1) : '', k2 = n2 ? this.dict.koName(n2) : ''
    if (!n2 && tpl.includes('{2}')) return null   // 2항 템플릿인데 이름 하나 → 합성 불가
    return tpl.replace('{1}', k1).replace('{2}', k2).replace(/\s+/g, ' ').trim()
  }
}
```
- [ ] **Step 4: 통과 → Commit**

---

### Task 6: 블록 재조립 `src/text/blocks.ts` (TDD)

- [ ] **Step 1: 테스트 `tests/blocks.test.ts`**
```ts
import { describe, it, expect } from 'vitest'
import { groupBlocks } from '../src/text/blocks'
const R = (x: number, y: number, t: string, c = 125) => ({ x, y, w: 5 * t.length, h: 8, t, c: [c, c, c] as [number, number, number], b: [0, 0, 0] as [number, number, number] })
describe('groupBlocks', () => {
  it('joins consecutive lines at same x with 7px pitch', () => {
    const b = groupBlocks([R(81, 73, 'It must be bolted from the other'), R(81, 80, 'side.'), R(0, 0, 'Lock Cell door')])
    expect(b).toHaveLength(2)
    const dlg = b.find(k => k.records.length === 2)!
    expect(dlg.joined).toBe('It must be bolted from the other side.'); expect(dlg.x).toBe(81); expect(dlg.y).toBe(73); expect(dlg.pitch).toBe(7)
    expect(dlg.w).toBe(5 * 'It must be bolted from the other'.length); expect(dlg.h).toBe(15)
  })
  it('keeps 8px pitch and splits on x change (talk name header)', () => {
    const b = groupBlocks([R(120, 60, 'Ratpouch', 255), R(70, 70, 'Hello there,'), R(70, 78, 'stranger.')])
    expect(b.map(k => k.joined)).toEqual(['Ratpouch', 'Hello there, stranger.'])
  })
  it('does not merge lines farther than 9px apart', () => {
    expect(groupBlocks([R(10, 10, 'a'), R(10, 30, 'b')])).toHaveLength(2)
  })
})
```
- [ ] **Step 2: 실패 확인** → **Step 3: 구현**
```ts
import type { LureTextRecord } from '../engine/types'
export interface TextBlock { x: number; y: number; w: number; h: number; pitch: number; color: [number, number, number]; bg: [number, number, number]; records: LureTextRecord[]; joined: string }
/** 같은 x(±1), 7~9px 아래로 이어지는 레코드를 한 블록으로. 입력 순서 무관. */
export function groupBlocks(records: LureTextRecord[]): TextBlock[] {
  const sorted = [...records].sort((a, b) => a.y - b.y || a.x - b.x)
  const blocks: TextBlock[] = []
  for (const r of sorted) {
    const last = blocks[blocks.length - 1]
    const prev = last?.records[last.records.length - 1]
    if (last && prev && Math.abs(r.x - last.x) <= 1) {
      const dy = r.y - prev.y
      if (dy >= 7 && dy <= 9 && (last.records.length === 1 || dy === last.pitch)) {
        last.records.push(r); last.pitch = dy; last.w = Math.max(last.w, r.x + r.w - last.x); last.h = r.y + r.h - last.y
        last.joined = last.records.map(k => k.t).join(' ').replace(/\s+/g, ' ').trim(); continue
      }
    }
    blocks.push({ x: r.x, y: r.y, w: r.w, h: r.h, pitch: 8, color: r.c, bg: r.b, records: [r], joined: r.t.trim() })
  }
  return blocks
}
```
- [ ] **Step 4: 통과 → Commit**

---

### Task 7: 한글 재줄바꿈 `src/text/kolayout.ts` (TDD)

- [ ] **Step 1: 테스트 `tests/kolayout.test.ts`** — measure 주입: 한글 1em·기타 0.5em
```ts
import { describe, it, expect } from 'vitest'
import { layoutKorean, wrapKorean } from '../src/text/kolayout'
const measure = (s: string, px: number) => [...s].reduce((a, ch) => a + (/[가-힣]/.test(ch) ? px : px / 2), 0)
describe('wrapKorean', () => {
  it('wraps at spaces within width', () => {
    expect(wrapKorean('감옥 문은 잠겨 있다', 8 * 6, 8, measure)).toEqual(['감옥 문은', '잠겨 있다'])
  })
  it('breaks a too-long word by character', () => { expect(wrapKorean('가나다라마바사', 8 * 4, 8, measure)).toEqual(['가나다라', '마바사']) })
})
describe('layoutKorean', () => {
  it('prefers the largest font that fits the block height', () => {
    // 영문 블록: 2줄, 피치 7 → h=15, 폭 160px. 한글 9자 → 10px 폰트로 1줄(90px) 가능
    const r = layoutKorean({ x: 81, y: 73, w: 160, h: 15, pitch: 7 }, '문은 잠겨 있다', measure)
    expect(r.fontPx).toBe(10); expect(r.lines).toEqual(['문은 잠겨 있다'])
  })
  it('shrinks font when text needs more lines', () => {
    const r = layoutKorean({ x: 0, y: 0, w: 40, h: 15, pitch: 7 }, '가나다라마바사아자차카타', measure)
    expect(r.fontPx).toBeLessThanOrEqual(8); expect(r.lines.length * r.fontPx).toBeLessThanOrEqual(15 + 6)
  })
})
```
- [ ] **Step 2: 실패 확인** → **Step 3: 구현**
```ts
export type Measure = (text: string, fontPx: number) => number
export interface BlockBox { x: number; y: number; w: number; h: number; pitch: number }
export interface KoLayout { fontPx: number; lines: string[]; lineHeight: number }
export function wrapKorean(text: string, widthPx: number, fontPx: number, measure: Measure): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let cur = ''
    for (const word of para.split(' ')) {
      if (!word) continue
      const cand = cur ? cur + ' ' + word : word
      if (measure(cand, fontPx) <= widthPx) { cur = cand; continue }
      if (cur) lines.push(cur)
      if (measure(word, fontPx) <= widthPx) { cur = word; continue }
      cur = ''
      for (const ch of word) { if (measure(cur + ch, fontPx) > widthPx && cur) { lines.push(cur); cur = '' } cur += ch }
    }
    lines.push(cur)
  }
  return lines
}
/** 영문 블록 박스 안에 들어가는 가장 큰 폰트(게임px)로 재줄바꿈. 폭은 블록 폭 + 여유 8px(말풍선 안쪽 여백) */
export function layoutKorean(box: BlockBox, ko: string, measure: Measure, slackH = 6): KoLayout {
  const width = box.w + 8
  for (const fontPx of [10, 9, 8, 7]) {
    const lines = wrapKorean(ko, width, fontPx, measure)
    if (lines.length * fontPx <= box.h + slackH) return { fontPx, lines, lineHeight: fontPx }
  }
  const lines = wrapKorean(ko, width, 7, measure); return { fontPx: 7, lines, lineHeight: 7 }
}
```
- [ ] **Step 4: 통과 → Commit**

---

### Task 8: 레이어 통합 + main 배선

**Files:** Modify `src/text/layer.ts`, `src/main.ts`, `src/engine/types.ts`(onString 5인자), `src/engine/loader.ts`

- [ ] **Step 1: types/loader** — `onString?(table: number, local: number, text: string, hotspot: string, char: string): void`; loader의 `onLureString` 5인자 전달.
- [ ] **Step 2: layer.ts** — 생성자에 `translateBlock?: (joined: string) => { text: string; partial?: number } | null` 추가. `render(next)`:
  1. 레코드 diff는 유지(영문 span은 **배경 박스만**, `textContent=''`인 상태로 엔진 글리프를 덮는다 — ko 모드일 때).
  2. `groupBlocks(next)` → 각 블록에 `translateBlock(block.joined)`; 결과가 있으면 `layoutKorean(block, text, this.measure)` → 블록 키(`x,y,joined`)로 `<div class="ko">` 생성/갱신(`left/top` = toCss, `font-size = fontPx*sy`, `line-height = fontPx*sy`, `color`, `white-space: pre`, 텍스트 = `lines.join('\n')`). `partial`(0~1)이 있으면 `text.slice(0, round(len*partial))`로 타이프라이터.
  3. 번역 없는 블록 → 영문 span에 `textContent = r.t` 복원(기존 동작).
  `measure`는 오프스크린 canvas 2D `ctx.font = \`${px}px NeoDGM\`` + `measureText().width` (CSS px 기준으로 호출하되 게임px 인자 × 현재 sx로 환산).
- [ ] **Step 3: main.ts** — `lang = params.get('lang') ?? 'ko'`; `ko`면 `fetch('/games/lure/ko.json')`+`strings.en.json`(둘 다 `public/games/lure/`로 심볼릭 링크: `ln -sfn ../../games/lure public/games/lure`… `.gitignore`의 `games/*/data/`만 제외되므로 json은 서빙 OK) → `KoDict`, `StatusComposer` 생성; `onString` → `dict.onString(...)`; `translateBlock` = `joined => { const s = dict.lookup(joined) ?? statusComposer.compose(joined); if (s) return { text: s }; const p = dict.lookupPrefix(joined); return p ? { text: p.full, partial: p.ratio } : null }`. `lang=en`이면 translateBlock 미설정(M2 동작).
- [ ] **Step 4: 수동 확인 + Commit** (한글 데이터 없이도 빌드·`lang=en` 회귀 없음: `node tools/smoke.mjs` OK)

---

### Task 9: 용어집 + 한글 초벌 + `tools/i18n-check.mjs`

- [ ] **Step 1: `games/lure/glossary.json`** — 덤프의 이름 문자열(table 0에서 대문자 시작·짧은 항목 + 상태줄에 등장한 hotspot 이름)에서 고유명사 추출 → 표기 확정. 최소: Diermot 디어모트, Ratpouch 랫파우치, Selena 셀레나, Skorl 스콜, Goewin 고윈, Luthern 루던, Grub 그럽, Morkus 모르쿠스, Turnvale 턴베일, Wulf 울프, Taidgh 타이그, Mallin 말린, Ewan 이완, Nellie 넬리, Minnow 미노우, Gwyn 그윈, Blacksmith 대장장이(직업명은 번역).
- [ ] **Step 2: `tools/i18n-check.mjs`** — strings.en.json vs ko.json:
  - 커버리지: 테이블별 번역률(빈 원문 제외), `list` 번역률 출력
  - 오류(exit 1): 플레이스홀더 집합 불일치(`{hotspot}`/`{char}` 존재 여부), ko 템플릿의 조사 문법 오류(`{hotspot:xx}`에서 xx가 지원 목록 밖), `list` 2항 액션(원문에 `{2}` 필요) 누락, 용어집 위반(영문에 용어가 있는데 한글에 표기가 없음)
  - 경고: 길이 — `koWidth = 한글 8px·기타 5px 합`, `enWidth = 5px × 길이`; `koWidth > enWidth × 1.15 + 40`이면 경고(폰트 7px까지 축소해도 넘칠 가능성)
  - `npm run i18n:check` 스크립트 등록
- [ ] **Step 3: 한글 초벌** — `strings.en.json`을 ID 순으로 **150개 청크**로 나눠 `ko.json`을 채운다(엔지니어 = LLM 직접 번역). 규칙: 용어집 준수, 1992 영국 판타지 코미디 톤(반말 서술·대화는 캐릭터 관계 반영), `{hotspot}`/`{char}`는 조사 포함 형태(`{hotspot:을}`)로, `\n`은 유지, 원문이 빈 문자열이면 생략. `list`는 액션 템플릿(`{1}`/`{2}`)로. 매 청크 후 `npm run i18n:check`.
- [ ] **Step 4: 완료 판정** — `i18n:check` 오류 0, 커버리지 테이블0 100%(테이블1·2는 ≥95%, 나머지는 영문 폴백), Commit(청크 단위로 커밋).

---

### Task 10: 한글 스모크 + 스크린샷 + NOTES

- [ ] **Step 1: `tools/smoke.mjs`에 `--lang=ko` 옵션** — `?lang=ko`로 부팅, 동일 시나리오, `#textlayer .ko` 개수 ≥ 2 및 `.ko` 텍스트에 한글 포함 확인, 스크린샷 `shots/m3-ko-*.png`.
- [ ] **Step 2: 실행 → SMOKE OK**, 스크린샷 육안 확인(말풍선 안에 들어가는지).
- [ ] **Step 3: NOTES.md** M3 섹션(키 체계 `table:local`, 상태줄 합성, 블록 재조립, 폰트 크기 선택, 함정) + Commit + main 머지.

---

## Self-Review
- 스펙 §4.3 템플릿/조사/용어집/i18n-check ✓(T3·T4·T9), §4.2 블록·폰트 ✓(T6·T7), 상태줄 합성(스펙에 없던 발견) T5 추가 ✓, 덤프 T1·T2 ✓, 폴백(번역 없으면 영문) T8 ✓.
- 타입: `KoDict.onString(table, local, en, hotspot, char)` ↔ loader 5인자 ↔ C++ `notifyString(int, uint16, const char*, const char*, const char*)` 일치. `TextBlock{x,y,w,h,pitch}` ↔ `layoutKorean(BlockBox)` 일치.
- 리스크: 테이블 문자열 수 공식(`tbl+2 − tbl`)이 틀리면 덤프가 쓰레기/빈 문자열을 낸다 → T2 Step 2에서 빈 비율·알려진 문자열 존재로 검증. 상태줄 합성이 실패하는 패턴은 영문 폴백.
