// 합성 MouseEvent가 SDL3(Emscripten) 엔진에 먹는지 실측: 캔버스에 mousemove/mousedown/mouseup을 JS로 디스패치하고 텍스트 레코드 변화를 본다.
import { createRequire } from 'node:module'
const require = createRequire('/Users/hytae/Downloads/cryzen-downloader/package.json'); const puppeteer = require('puppeteer')
const base = process.argv[2] || 'http://localhost:3046/'; const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 900 })
const logs = []; page.on('console', m => logs.push(m.text()))
await page.goto(base + '?lang=en', { waitUntil: 'load' }); await page.click('#startBtn')
const t0 = Date.now(); while (!logs.some(l => l.includes('Running Lure')) && Date.now() - t0 < 60000) await sleep(500)
await sleep(12000)
const box = await (await page.$('#canvas')).boundingBox(); const gx = x => box.x + x * box.width / 320, gy = y => box.y + y * box.height / 200
// 인트로 스킵은 실제 입력으로
await page.mouse.click(gx(160), gy(100)); await sleep(2500); await page.keyboard.press('Escape'); await sleep(2500); await page.keyboard.press('Escape'); await sleep(3000)
const dump = () => page.evaluate(() => (window.__lureText || []).map(r => r.t))
console.log('before:', JSON.stringify(await dump()))
// 합성: 문 위로 mousemove → 상태줄에 "Cell door" 기대
const PE = (type, x, y, button, buttons) => `(() => { const c = document.getElementById('canvas'); const e = new PointerEvent('${type}', { clientX: ${x}, clientY: ${y}, button: ${button}, buttons: ${buttons}, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true }); c.dispatchEvent(e); return e.defaultPrevented })()`
console.log('pointermove prevented:', await page.evaluate(PE('pointermove', gx(88), gy(130), 0, 0)))
await sleep(1500); console.log('after synth move:', JSON.stringify(await dump()))
// 합성 우버튼 다운 → 팝업 기대
console.log('pointerdown prevented:', await page.evaluate(PE('pointerdown', gx(88), gy(130), 2, 2)))
await sleep(1500); const menu = await dump(); console.log('after synth rdown:', JSON.stringify(menu))
await page.evaluate(PE('pointerup', gx(88), gy(130), 2, 0))
await sleep(1500); console.log('after synth rup:', JSON.stringify(await dump()))
await browser.close()
console.log(menu.length >= 3 ? 'SYNTH OK' : 'SYNTH FAIL')
