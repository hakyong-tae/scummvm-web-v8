// 게임 무관 헤드리스 부팅 스모크: 부팅 → 엔진 기동 → 화면 렌더 확인 → 키 입력 → 스크린샷
//   node tools/smoke-boot.mjs --game=soltys [--secs=25] [--steps=...] [baseUrl]
//   --steps 는 ';' 로 구분한 순서 있는 동작: key:Escape · move:x,y · click:x,y · rclick:x,y · wait:3 · shot:이름
//   좌표는 320x200 게임 좌표(캔버스 박스에 선형 매핑)
// 판정: (1) "Running …" 로그 (2) 캔버스 영역 스크린샷이 단색이 아님(고유색 ≥ 8) (3) pageerror 0
// 주의: 캔버스를 drawImage/getImageData로 읽으면 WebGL 드로잉 버퍼가 프레임 밖에서 비어 항상 검게 나온다 → 스크린샷을 디코드한다.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { decodePng, imageStats } from './lib/png.mjs'
const require = createRequire('/Users/hytae/Downloads/cryzen-downloader/package.json')
const puppeteer = require('puppeteer')

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const game = arg('game', 'lure')
const secs = Number(arg('secs', '25'))
const steps = arg('steps', '') ? arg('steps', '').split(';').filter(Boolean) : []
const base = process.argv.filter(a => !a.startsWith('--'))[2] || 'http://localhost:3046/'
const outDir = new URL('../docs/superpowers/plans/shots/', import.meta.url).pathname
mkdirSync(outDir, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1400,900',
         '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })
const logs = [], errors = []
page.on('console', m => logs.push(m.text()))
page.on('pageerror', e => { errors.push(e.message); logs.push('PAGEERROR ' + e.message) })
await page.goto(`${base}?game=${game}&lang=en`, { waitUntil: 'load' })
await page.click('#startBtn')

const t0 = Date.now()
while (!logs.some(l => /Running /.test(l)) && Date.now() - t0 < 90000) await sleep(500)
const running = logs.find(l => /Running /.test(l))
console.log(`engine running after ${Date.now() - t0}ms:`, running ?? '(NOT SEEN)')

// 캔버스 영역 스크린샷 → PNG 디코드 → 픽셀 통계(검은 화면/단색이면 부팅 실패로 본다)
const shot = async (name) => {
  const box = await (await page.$('#canvas')).boundingBox()
  const clip = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }
  const recs = await page.evaluate(() => (window.__lureText || []).map(r => `${r.t}@${r.x},${r.y}`))
  const spans = await page.evaluate(() => [...document.querySelectorAll('#textlayer span')].map(d => d.textContent))
  const koDivs = await page.evaluate(() => [...document.querySelectorAll('#textlayer .ko')].map(d => d.textContent))
  const buf = await page.screenshot({ clip })
  const path = `${outDir}s1-${game}-${name}.png`
  writeFileSync(path, buf)
  return { ...imageStats(decodePng(buf)), recs, spans, koDivs, path }
}

const shots = []
for (let i = 1; i <= Math.ceil(secs / 5); i++) {
  await sleep(5000)
  const s = await shot(`t${i * 5}s`); shots.push(s)
  console.log(`t+${i * 5}s`, JSON.stringify(s))
}
// 순서 있는 동작 실행
const gxy = async () => {
  const b = await (await page.$('#canvas')).boundingBox()
  return [x => b.x + x * b.width / 320, y => b.y + y * b.height / 200]
}
for (const [i, step] of steps.entries()) {
  const [op, val = ''] = step.split(':')
  const [gx, gy] = await gxy()
  const [x, y] = val.split(',').map(Number)
  if (op === 'key') { await page.keyboard.press(val); await sleep(2500) }
  else if (op === 'move') { await page.mouse.move(gx(x), gy(y)); await sleep(2000) }
  else if (op === 'click') { await page.mouse.click(gx(x), gy(y)); await sleep(3000) }
  else if (op === 'rclick') { await page.mouse.click(gx(x), gy(y), { button: 'right' }); await sleep(3000) }
  else if (op === 'wait') { await sleep(Number(val) * 1000) }
  else if (op === 'shot') { /* fall through to the shot below */ }
  else { console.log('unknown step', step); process.exitCode = 1 }
  const s = await shot(op === 'shot' ? val : `step${i + 1}-${op}`); shots.push(s)
  console.log(`step ${i + 1} ${step}`, JSON.stringify({ recs: s.recs, spans: s.spans, koDivs: s.koDivs, colors: s.colors }))
}
const best = shots.reduce((a, b) => (b.colors > a.colors ? b : a), shots[0] ?? { colors: 0 })
const ok = !!running && best.colors >= 8 && errors.length === 0
console.log('--- last logs ---\n' + logs.slice(-25).join('\n'))
console.log(`RESULT ${ok ? 'PASS' : 'FAIL'} — running=${!!running} maxColors=${best.colors} pageerrors=${errors.length}`)
await browser.close()
process.exit(ok ? 0 : 1)
