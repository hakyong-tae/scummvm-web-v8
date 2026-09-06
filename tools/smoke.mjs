// 헤드리스 스모크: 부팅 → 인트로 스킵 → 핫스팟 클릭 → 텍스트 레코드/DOM span 확인 → 스크린샷
// 실행: node tools/smoke.mjs [baseUrl]   (dev 서버가 떠 있어야 함)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('/Users/hytae/Downloads/cryzen-downloader/package.json')
const puppeteer = require('puppeteer')

const langArg = process.argv.find(a => a.startsWith('--lang=')); const lang = langArg ? langArg.slice(7) : 'en'
const touch = process.argv.includes('--touch')
const base = process.argv.filter(a => !a.startsWith('--'))[2] || 'http://localhost:3046/'
const outDir = new URL('../docs/superpowers/plans/shots/', import.meta.url).pathname
const tag = touch ? 'm4-touch-' : lang === 'ko' ? 'm3-ko-' : 'm2-'
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
if (touch) { const cdp = await page.createCDPSession(); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: false }) }
await page.goto(base + `?layer=1&lang=${lang}${touch ? '&touch=1' : ''}`, { waitUntil: 'load' })
await page.click('#startBtn')
// 엔진 기동 대기
const t0 = Date.now()
while (!logs.some(l => l.includes('Running Lure')) && Date.now() - t0 < 60000) await sleep(500)
console.log('engine running after', Date.now() - t0, 'ms'); if (process.env.SMOKE_LOGS || !logs.some(l => l.includes('Running Lure'))) console.log('--- logs ---\n' + logs.slice(-40).join('\n'))
await sleep(12000)
await page.screenshot({ path: outDir + tag + 'boot.png' })
const canvas = await page.$('#canvas')
const box = await canvas.boundingBox()
const gx = (x) => box.x + x * box.width / 320, gy = (y) => box.y + y * box.height / 200
console.log('canvas box', box)
// 인트로 스킵: 클릭 + Escape 두 번
await page.mouse.click(gx(160), gy(100)); await sleep(2500)
await page.keyboard.press('Escape'); await sleep(2500)
await page.keyboard.press('Escape'); await sleep(4000)
// 인트로가 이미 끝난 뒤의 Escape는 인게임 종료 확인("Are you sure (y/n)?")을 띄운다 → n으로 닫기
if ((await page.evaluate(() => (window.__lureText || []).map(r => r.t).join('|'))).includes('Are you sure')) { await page.keyboard.press('n'); await sleep(1500); console.log('dismissed quit confirm') }
await page.screenshot({ path: outDir + tag + 'room.png' })
// 첫 방: 감옥 문(88,130)에서 우클릭 홀드 → 동사 팝업(버튼을 누른 동안 표시) → 놓으면 선택된 "Look" 실행 → 설명 대화창
const dump = () => page.evaluate(() => (window.__lureText || []).map(r => r.t + '@' + r.x + ',' + r.y))
if (touch) {
  // 트랙패드 모드: 탭 = 클릭(커서 자리), 드래그 = 커서 이동, 롱프레스 = 동사 팝업
  const ts = page.touchscreen
  // 가상 커서 시작점 = 캔버스 중앙(게임 160,100). 문(88,130)까지의 델타만큼 드래그
  await ts.touchStart(gx(200), gy(150)); await ts.touchMove(gx(200) + (gx(88) - gx(160)), gy(150) + (gy(130) - gy(100))); await ts.touchEnd(); await sleep(800)
  const hover = await dump(); console.log('touch hover:', JSON.stringify(hover))
  await ts.touchStart(gx(200), gy(150)); await sleep(900)                       // 롱프레스(정지) → 우버튼 다운(동사 팝업)
  var menuState = await dump(); console.log('verb popup (touch hold):', JSON.stringify(menuState))
  await page.screenshot({ path: outDir + tag + 'menu.png' })
  await ts.touchEnd(); await sleep(6000)
} else {
await page.mouse.move(gx(88), gy(130)); await sleep(800)
await page.mouse.down({ button: 'right' }); await sleep(2000)
var menuState = await dump(); console.log('verb popup (held):', JSON.stringify(menuState))
await page.screenshot({ path: outDir + tag + 'menu.png' })
await page.mouse.up({ button: 'right' }); await sleep(6000)
}
const dialogState = await dump(); console.log('after Look:', JSON.stringify(dialogState))
await page.screenshot({ path: outDir + tag + 'dialog.png' })
await page.mouse.click(gx(160), gy(180)); await sleep(2500)   // 대화창 닫기
const closedState = await dump(); console.log('after close:', JSON.stringify(closedState))
if (touch) { const t2 = await dump(); console.log('touch final:', JSON.stringify(t2)) }
const koDivs = await page.evaluate(() => [...document.querySelectorAll('#textlayer .ko')].map(d => ({ t: d.textContent, font: d.dataset.font, left: d.style.left, top: d.style.top })))
console.log('ko blocks:', JSON.stringify(koDivs))
await page.screenshot({ path: outDir + tag + 'closed.png' })
const state = await page.evaluate(() => ({
  recs: (window.__lureText || []),
  spans: [...document.querySelectorAll('#textlayer span')].map(s => ({ t: s.textContent, left: s.style.left, top: s.style.top, font: s.style.fontSize })),
}))
console.log(JSON.stringify(state, null, 1))
await page.screenshot({ path: outDir + tag + 'layer-on.png' })
await page.evaluate(() => { document.getElementById('textlayer').hidden = true })
await page.screenshot({ path: outDir + tag + 'layer-off.png' })
const errs = logs.filter(l => /lure-callback|PAGEERROR|Uncaught/.test(l))
console.log('errors:', errs.length, errs.slice(0, 5))
const perf = logs.filter(l => l.includes('[perf]'))
console.log('perf:', perf.slice(-2))
await browser.close()
const koOk = lang !== 'ko' || (koDivs.length >= 2 && koDivs.every(d => /[가-힣]/.test(d.t)))
const ok = menuState.length >= 2 && dialogState.length >= 3 && closedState.length < dialogState.length && state.spans.length === state.recs.length && errs.length === 0 && koOk
console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL')
process.exit(ok ? 0 : 1)
