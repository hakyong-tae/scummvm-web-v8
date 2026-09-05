// 헤드리스 스모크: 부팅 → 인트로 스킵 → 핫스팟 클릭 → 텍스트 레코드/DOM span 확인 → 스크린샷
// 실행: node tools/smoke.mjs [baseUrl]   (dev 서버가 떠 있어야 함)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('/Users/hytae/Downloads/cryzen-downloader/package.json')
const puppeteer = require('puppeteer')

const base = process.argv[2] || 'http://localhost:3046/'
const outDir = new URL('../docs/superpowers/plans/shots/', import.meta.url).pathname
mkdirSync(outDir, { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1400,900',
         '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })
const logs = []
page.on('console', async m => { let t = m.text(); if (t.includes('JSHandle@error')) { try { t = (await Promise.all(m.args().map(a => a.evaluate(e => e && e.message ? e.message + ' | ' + String(e.stack).slice(0, 200) : String(e))))).join(' ') } catch {} } logs.push(t) })
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message))
await page.goto(base + '?layer=1', { waitUntil: 'load' })
await page.click('#startBtn')
// 엔진 기동 대기
const t0 = Date.now()
while (!logs.some(l => l.includes('Running Lure')) && Date.now() - t0 < 60000) await sleep(500)
console.log('engine running after', Date.now() - t0, 'ms'); if (process.env.SMOKE_LOGS || !logs.some(l => l.includes('Running Lure'))) console.log('--- logs ---\n' + logs.slice(-40).join('\n'))
await sleep(12000)
await page.screenshot({ path: outDir + 'm1-boot.png' })
const canvas = await page.$('#canvas')
const box = await canvas.boundingBox()
const gx = (x) => box.x + x * box.width / 320, gy = (y) => box.y + y * box.height / 200
console.log('canvas box', box)
// 인트로 스킵: 클릭 + Escape 두 번
await page.mouse.click(gx(160), gy(100)); await sleep(2500)
await page.keyboard.press('Escape'); await sleep(2500)
await page.keyboard.press('Escape'); await sleep(4000)
await page.screenshot({ path: outDir + 'm2-room.png' })
// 첫 방: 감옥 문(왼콽 벽) 클릭 → "Look at Cell door" + 설명 대화창
await page.mouse.click(gx(88), gy(130)); await sleep(3000)
const state = await page.evaluate(() => ({
  recs: (window.__lureText || []),
  spans: [...document.querySelectorAll('#textlayer span')].map(s => ({ t: s.textContent, left: s.style.left, top: s.style.top, font: s.style.fontSize })),
}))
console.log(JSON.stringify(state, null, 1))
await page.screenshot({ path: outDir + 'm2-layer-on.png' })
await page.evaluate(() => { document.getElementById('textlayer').hidden = true })
await page.screenshot({ path: outDir + 'm2-layer-off.png' })
const errs = logs.filter(l => /lure-callback|PAGEERROR|Uncaught/.test(l))
console.log('errors:', errs.length, errs.slice(0, 5))
const perf = logs.filter(l => l.includes('[perf]'))
console.log('perf:', perf.slice(-2))
await browser.close()
process.exit(state.recs.length >= 2 && state.spans.length === state.recs.length && errs.length === 0 ? 0 : 1)
