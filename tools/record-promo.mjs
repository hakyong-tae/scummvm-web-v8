// 15초 정방형 홍보 영상 + 썸네일. 실행: node tools/record-promo.mjs [baseUrl]  → promo/lure-kr-15s.mp4, promo/lure-kr-thumb.png
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const require = createRequire('/Users/hytae/Downloads/cryzen-downloader/package.json'); const puppeteer = require('puppeteer')
const base = process.argv[2] || 'http://localhost:3046/'
const out = new URL('../promo/', import.meta.url).pathname; const frames = out + 'frames/'
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const SIZE = 1080, FPS = 30, SECONDS = 15
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required', `--window-size=${SIZE},${SIZE}`, '--force-device-scale-factor=1'] })
const page = await browser.newPage(); await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 })
const logs = []; page.on('console', m => logs.push(m.text()))
await page.goto(base + '?lang=ko&promo=1', { waitUntil: 'load' }); await page.click('#startBtn')
const t0 = Date.now(); while (!logs.some(l => l.includes('Running Lure')) && Date.now() - t0 < 60000) await sleep(500)
await sleep(12000)
const box = await (await page.$('#canvas')).boundingBox(); const gx = x => box.x + x * box.width / 320, gy = y => box.y + y * box.height / 200
// 인트로 스킵
await page.mouse.click(gx(160), gy(100)); await sleep(2500); await page.keyboard.press('Escape'); await sleep(2500); await page.keyboard.press('Escape'); await sleep(3500)
if ((await page.evaluate(() => (window.__lureText || []).map(r => r.t).join('|'))).includes('Are you sure')) { await page.keyboard.press('n'); await sleep(1500) }
await page.mouse.move(gx(160), gy(180)); await sleep(1000)

// ── 녹화 시작(CDP screencast, 프레임 + 타임스탬프) ──
const cdp = await page.createCDPSession(); let n = 0; const times = []
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  writeFileSync(`${frames}f${String(n).padStart(5, '0')}.jpg`, Buffer.from(data, 'base64')); times.push(metadata.timestamp); n++
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: SIZE, maxHeight: SIZE, everyNthFrame: 1 })
const rec0 = Date.now()
// 시나리오(≈15s): 문으로 커서 이동(한글 핫스팟) → 롱프레스 팝업 → Look 선택 → 대화창 → 닫고 걸어가기
await page.mouse.move(gx(120), gy(150), { steps: 20 }); await sleep(300)
await page.mouse.move(gx(88), gy(130), { steps: 25 }); await sleep(1500)                 // "감옥 문"
await page.mouse.down({ button: 'right' }); await sleep(1600)                           // 동사 팝업(한글)
await page.mouse.move(gx(88), gy(122), { steps: 10 }); await sleep(600)
await page.mouse.up({ button: 'right' }); await sleep(400)
await page.mouse.click(gx(28), gy(88)); await sleep(3200)                               // 첫 항목 클릭(대화창)
let thumbAt = Date.now()
await page.screenshot({ path: out + 'lure-kr-thumb.png' })
await sleep(1800)
await page.mouse.click(gx(220), gy(175)); await sleep(1500)                             // 닫고 바닥 클릭 → 걸어감
await page.mouse.move(gx(250), gy(120), { steps: 30 }); await sleep(1200)
await page.mouse.move(gx(180), gy(90), { steps: 30 }); await sleep(1000)                // 창문 호버
while (Date.now() - rec0 < SECONDS * 1000) await sleep(100)
await cdp.send('Page.stopScreencast'); await sleep(300)
console.log('frames', n, 'thumb at', ((thumbAt - rec0) / 1000).toFixed(1) + 's')
await browser.close()

// ── ffmpeg: 가변 프레임 → 30fps mp4 (concat demuxer, 각 프레임 표시시간 = 다음 타임스탬프까지) ──
const files = readdirSync(frames).filter(f => f.endsWith('.jpg')).sort()
let concat = ''
for (let i = 0; i < files.length; i++) { const d = i + 1 < times.length ? Math.max(0.01, times[i + 1] - times[i]) : 1 / FPS; concat += `file '${frames}${files[i]}'\nduration ${d.toFixed(4)}\n` }
concat += `file '${frames}${files[files.length - 1]}'\n`
writeFileSync(out + 'concat.txt', concat)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', out + 'concat.txt', '-vf', `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease,pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:black,fps=${FPS},format=yuv420p`, '-t', String(SECONDS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', out + 'lure-kr-15s.mp4'])
rmSync(frames, { recursive: true, force: true }); rmSync(out + 'concat.txt', { force: true })
console.log('done:', out + 'lure-kr-15s.mp4', out + 'lure-kr-thumb.png')
