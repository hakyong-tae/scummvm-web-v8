// 전수 문자열 덤프: 엔진 훅(Module.lureDumpRequest → Module.onLureDump)으로 3개 테이블 + StringList를 받아 저장
// 실행: node tools/dump-strings.mjs [baseUrl]   (dev 서버 필요)
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const require = createRequire('/Users/hytae/Downloads/cryzen-downloader/package.json')
const puppeteer = require('puppeteer')
const base = process.argv[2] || 'http://localhost:3046/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 900 })
const logs = []; page.on('console', m => logs.push(m.text()))
await page.goto(base + '?layer=0&lang=en', { waitUntil: 'load' })
await page.click('#startBtn')
await page.waitForFunction(() => window.Module && window.Module.onLureText, { timeout: 60000 })
await page.evaluate(() => { window.__dump = null; window.Module.onLureDump = j => { window.__dump = j } })
const t0 = Date.now(); while (!logs.some(l => l.includes('Running Lure')) && Date.now() - t0 < 60000) await sleep(500)
await sleep(12000)
const box = await (await page.$('#canvas')).boundingBox()
const gx = x => box.x + x * box.width / 320, gy = y => box.y + y * box.height / 200
await page.mouse.click(gx(160), gy(100)); await sleep(2500); await page.keyboard.press('Escape'); await sleep(2500); await page.keyboard.press('Escape'); await sleep(3000)
await page.evaluate(() => { window.Module.lureDumpRequest = 1 })
await page.mouse.move(gx(150), gy(120)); await sleep(500); await page.mouse.move(gx(170), gy(130)); await sleep(500)
await page.waitForFunction(() => window.__dump !== null, { timeout: 30000 })
const dump = JSON.parse(await page.evaluate(() => window.__dump))
const out = { list: dump.list, tables: dump.tables, hotspots: dump.hotspots || [], counts: dump.tables.map(t => t.length), listCount: dump.list.length }
writeFileSync(new URL('../games/lure/strings.en.json', import.meta.url), JSON.stringify(out, null, 1))
const empty = dump.tables.map(t => t.filter(s => !s).length)
console.log('list', out.listCount, 'tables', out.counts, 'total', out.counts.reduce((a, b) => a + b, 0), 'empty', empty)
await browser.close()
