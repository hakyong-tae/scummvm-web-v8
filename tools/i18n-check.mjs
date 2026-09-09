// ko.json 검수 — 게임별 사전 형태를 자동 판별한다.
//   node tools/i18n-check.mjs [--game=lure|soltys]
// lure  : 테이블:로컬 키 + 조사/플레이스홀더 문법 + 2항 액션 템플릿
// soltys: SAY ref 키 (플레이스홀더·조사 없음) + skip 목록 정합성 + 줄 수/길이
import { readFileSync, existsSync } from 'node:fs'
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const game = arg('game', 'lure')
const root = new URL(`../games/${game}/`, import.meta.url)
const en = JSON.parse(readFileSync(new URL('strings.en.json', root), 'utf8'))
const ko = JSON.parse(readFileSync(new URL('ko.json', root), 'utf8'))
const gpath = new URL('glossary.json', root)
const glossary = existsSync(gpath) ? JSON.parse(readFileSync(gpath, 'utf8')) : {}
const errors = [], warns = []
const width = s => [...s].reduce((a, c) => a + (/[가-힣]/.test(c) ? 8 : 5), 0)
const hasHangul = s => /[가-힣]/.test(s)

if (en.say) {
  // ── ref 사전(CGE 계열) ────────────────────────────────────────────────────
  const t = ko.t ?? {}, skip = ko.skip ?? {}, names = ko.names ?? {}
  for (const k of Object.keys(t)) if (!(k in en.say)) errors.push(`t[${k}]: 원문에 없는 ref`)
  for (const k of Object.keys(skip)) if (!(k in en.say)) errors.push(`skip[${k}]: 원문에 없는 ref`)
  for (const k of Object.keys(t)) if (k in skip) errors.push(`${k}: t와 skip에 동시에 있음`)
  const missing = Object.keys(en.say).filter(k => !(k in t) && !(k in skip))
  for (const k of missing) warns.push(`${k}: 미번역 → "${en.say[k].slice(0, 50)}"`)

  for (const [k, v] of Object.entries(t)) {
    const s = en.say[k]; if (!s) continue
    if (!hasHangul(v)) warns.push(`${k}: 한글이 없음(미번역 잔재?) → "${v.slice(0, 50)}"`)
    // 엔진이 만든 말풍선 높이는 영문 줄 수로 정해진다 — 한글이 더 많은 줄이면 넘친다
    const enLines = s.split(/[|\n]/).length, koLines = v.split('\n').length
    if (koLines > enLines) errors.push(`${k}: 줄 수 초과 (ko ${koLines} > en ${enLines})`)
    // 한 줄 폭도 영문 말풍선 폭 안에 들어가야 한다(레이어가 폰트를 줄이지만 한계가 있음)
    const enW = Math.max(...s.split(/[|\n]/).map(width)), koW = Math.max(...v.split('\n').map(width))
    if (koW > enW * 1.15 + 40) warns.push(`${k}: 길이 초과 위험 (ko ${koW}px vs en ${enW}px)`)
    for (const [term, tr] of Object.entries(glossary)) {
      if (new RegExp(`\\b${term}\\b`).test(s) && !v.includes(tr)) warns.push(`${k}: 용어 "${term}"→"${tr}" 미사용 → "${v.slice(0, 50)}"`)
    }
  }
  for (const [e, k] of Object.entries(names)) if (!hasHangul(k)) warns.push(`names["${e}"]: 한글이 없음 → "${k}"`)
  const total = Object.keys(en.say).length
  console.log(`${game}: 번역 ${Object.keys(t).length} / 대상 ${total - Object.keys(skip).length} (전체 ${total}, 의도적 미번역 ${Object.keys(skip).length}), 이름 ${Object.keys(names).length}`)
} else {
  // ── lure(테이블:로컬 키) ──────────────────────────────────────────────────
  const PARTICLES = new Set(['을', '를', '은', '는', '이', '가', '과', '와', '으로', '로', '아', '야'])
  const TWO_ARG_ACTIONS = new Set(['Give', 'Use', 'Tell', 'Ask'])   // "X to Y", "X on Y", "Y for X" 형태로 두 이름을 받는 액션
  const DEBUG_STR = /^(ROOM\d+|MEGA\d+|mega\d+|NULL|ULL|\?|!|q\d+|Shop 1 ROOM33|Unnamed room ROOM37|The Revolution Test Message|Kill Saddam|Water, water, etc)$/
  let listDone = 0, listTotal = 0
  en.list.forEach((s, i) => {
    if (!s.trim()) return
    listTotal++
    const k = ko.list[String(i)]; if (!k) return
    listDone++
    if (TWO_ARG_ACTIONS.has(s) && !/\{2(?::[^}]+)?\}/.test(k.split('|')[0])) errors.push(`list[${i}] "${s}": 2항 액션인데 {2} 없음 → "${k}"`)
  })
  const cov = []
  en.tables.forEach((tbl, t) => {
    let done = 0, skipped = 0
    tbl.forEach((s, i) => {
      const key = `${t}:${i}`; const k = ko.t[key]
      if (DEBUG_STR.test(s.trim())) { skipped++; return }
      if (!k) return
      done++
      const enPh = new Set([...s.matchAll(/\{(hotspot|char)\}/g)].map(m => m[1]))
      const koPh = new Set([...k.matchAll(/\{(hotspot|char)(?::([^}]+))?\}/g)].map(m => m[1]))
      for (const p of enPh) if (!koPh.has(p)) errors.push(`${key}: 플레이스홀더 {${p}} 누락 → "${k}"`)
      for (const p of koPh) if (!enPh.has(p)) errors.push(`${key}: 원문에 없는 플레이스홀더 {${p}} → "${k}"`)
      for (const m of k.matchAll(/\{(?:hotspot|char):([^}]+)\}/g)) if (!PARTICLES.has(m[1])) errors.push(`${key}: 지원하지 않는 조사 "${m[1]}"`)
      for (const [term, tr] of Object.entries(glossary)) {
        if (new RegExp(`\\b${term}\\b`).test(s) && !k.includes(tr)) warns.push(`${key}: 용어 "${term}"→"${tr}" 미사용 → "${k.slice(0, 60)}"`)
      }
      if (width(k) > width(s) * 1.15 + 40) warns.push(`${key}: 길이 초과 위험 (ko ${width(k)}px vs en ${width(s)}px)`)
    })
    cov.push({ t, done, total: tbl.length - skipped })
  })
  console.log(`list: ${listDone}/${listTotal}`)
  for (const c of cov) console.log(`table ${c.t}: ${c.done}/${c.total} (${(100 * c.done / c.total).toFixed(1)}%)`)
}

if (warns.length) { console.log(`\n경고 ${warns.length}건`); for (const w of warns.slice(0, 40)) console.log('  ' + w); if (warns.length > 40) console.log(`  … +${warns.length - 40}`) }
if (errors.length) { console.log(`\n오류 ${errors.length}건`); for (const e of errors) console.log('  ' + e); process.exit(1) }
console.log('\ni18n-check OK')
