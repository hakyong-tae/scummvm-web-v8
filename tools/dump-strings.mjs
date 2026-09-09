// 전수 문자열 덤프: 엔진 훅(Module.lureDumpRequest → Module.onLureDump)으로 게임의 문자열 테이블을 받아 저장
//   node tools/dump-strings.mjs [--game=lure|soltys] [baseUrl]   (dev 서버 필요)
// lure  : 허프만 테이블 3개 + StringList + hotspots  → games/lure/strings.en.json
// soltys: SAY 파일의 (ref → 평문) 전부            → games/soltys/strings.en.json
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const require = createRequire('/Users/hytae/Downloads/cryzen-downloader/package.json')
const puppeteer = require('puppeteer')
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const game = arg('game', 'lure')
const base = process.argv.filter(a => !a.startsWith('--'))[2] || 'http://localhost:3046/'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 900 })
const logs = []; page.on('console', m => logs.push(m.text()))
await page.goto(base + `?game=${game}&layer=0&lang=en`, { waitUntil: 'load' })
await page.click('#startBtn')
await page.waitForFunction(() => window.Module && window.Module.onLureText, { timeout: 60000 })
await page.evaluate(() => { window.__dump = null; window.Module.onLureDump = j => { window.__dump = j } })
const t0 = Date.now(); while (!logs.some(l => /Running /.test(l)) && Date.now() - t0 < 60000) await sleep(500)
await sleep(12000)
const box = await (await page.$('#canvas')).boundingBox()
const gx = x => box.x + x * box.width / 320, gy = y => box.y + y * box.height / 200
// 인트로를 지나 게임 루프에 들어가야 덤프 폴링 지점(present/frame)이 돈다
await page.mouse.click(gx(160), gy(100)); await sleep(2500); await page.keyboard.press('Escape'); await sleep(2500); await page.keyboard.press('Escape'); await sleep(3000)
await page.evaluate(() => { window.Module.lureDumpRequest = 1 })
await page.mouse.move(gx(150), gy(120)); await sleep(500); await page.mouse.move(gx(170), gy(130)); await sleep(500)
await page.waitForFunction(() => window.__dump !== null, { timeout: 30000 })
const dump = JSON.parse(await page.evaluate(() => window.__dump))
const dest = new URL(`../games/${game}/strings.en.json`, import.meta.url)

if (game === 'lure') {
  const out = { list: dump.list, tables: dump.tables, hotspots: dump.hotspots || [], counts: dump.tables.map(t => t.length), listCount: dump.list.length }
  writeFileSync(dest, JSON.stringify(out, null, 1))
  const empty = dump.tables.map(t => t.filter(s => !s).length)
  console.log('list', out.listCount, 'tables', out.counts, 'total', out.counts.reduce((a, b) => a + b, 0), 'empty', empty)
} else {
  const say = dump.say || {}
  const refs = Object.keys(say)
  const chars = refs.reduce((n, k) => n + say[k].length, 0)
  writeFileSync(dest, JSON.stringify({ count: refs.length, chars, say }, null, 1))
  console.log(`refs ${refs.length}, ${chars} chars, ref range ${Math.min(...refs.map(Number))}..${Math.max(...refs.map(Number))}`)
}
await browser.close()
