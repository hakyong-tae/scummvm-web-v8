// ko.json 검수: 커버리지 · 플레이스홀더/조사 문법 · 2항 액션 템플릿 · 용어집 · 길이 경고
import { readFileSync } from 'node:fs'
const root = new URL('../games/lure/', import.meta.url)
const en = JSON.parse(readFileSync(new URL('strings.en.json', root), 'utf8'))
const ko = JSON.parse(readFileSync(new URL('ko.json', root), 'utf8'))
const glossary = JSON.parse(readFileSync(new URL('glossary.json', root), 'utf8'))
const PARTICLES = new Set(['을', '를', '은', '는', '이', '가', '과', '와', '으로', '로', '아', '야'])
const TWO_ARG_ACTIONS = new Set(['Give', 'Use', 'Tell', 'Ask'])   // "X to Y", "X on Y", "Y for X" 형태로 두 이름을 받는 액션
const errors = [], warns = []
const width = s => [...s].reduce((a, c) => a + (/[가-힣]/.test(c) ? 8 : 5), 0)
const DEBUG_STR = /^(ROOM\d+|MEGA\d+|mega\d+|NULL|ULL|\?|!|q\d+|Shop 1 ROOM33|Unnamed room ROOM37|The Revolution Test Message|Kill Saddam|Water, water, etc)$/

// list
let listDone = 0, listTotal = 0
en.list.forEach((s, i) => {
  if (!s.trim()) return
  listTotal++
  const k = ko.list[String(i)]; if (!k) return
  listDone++
  if (TWO_ARG_ACTIONS.has(s) && !/\{2(?::[^}]+)?\}/.test(k.split('|')[0])) errors.push(`list[${i}] "${s}": 2항 액션인데 {2} 없음 → "${k}"`)
})
// tables
const cov = []
en.tables.forEach((tbl, t) => {
  let done = 0
  let skipped = 0
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
if (warns.length) { console.log(`\n경고 ${warns.length}건`); for (const w of warns.slice(0, 40)) console.log('  ' + w); if (warns.length > 40) console.log(`  … +${warns.length - 40}`) }
if (errors.length) { console.log(`\n오류 ${errors.length}건`); for (const e of errors) console.log('  ' + e); process.exit(1) }
console.log('\ni18n-check OK')
