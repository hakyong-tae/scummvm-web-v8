import { bootEngine } from './engine/loader'
import { TextLayer } from './text/layer'
import { KoDict, type EnDump, type KoData } from './i18n/dict'
import { StatusComposer } from './i18n/status'
import { resolveBlock } from './i18n/resolve'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const frame = document.getElementById('frame')!
const startEl = document.getElementById('start')!
const startBtn = document.getElementById('startBtn') as HTMLButtonElement
const statusEl = document.getElementById('status')!
const params = new URLSearchParams(location.search)

const GAME_W = 320, GAME_H = 200

function fitCanvas() {
  const k = Math.max(1, Math.floor(Math.min(innerWidth / GAME_W, innerHeight / GAME_H)))
  canvas.style.width = `${GAME_W * k}px`
  canvas.style.height = `${GAME_H * k}px`
  frame.style.width = canvas.style.width
  frame.style.height = canvas.style.height
}
addEventListener('resize', fitCanvas)
fitCanvas()

function perfProbe() {
  if (!params.has('perf')) return
  let long = 0, longMs = 0
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { long++; longMs += e.duration } })
    .observe({ type: 'longtask', buffered: true })
  let frames = 0, last = performance.now()
  const tick = (t: number) => {
    frames++
    if (t - last >= 5000) {
      console.log(`[perf] rAF ${(frames / ((t - last) / 1000)).toFixed(1)}/s, longtasks ${long} (${longMs.toFixed(0)}ms)`)
      frames = 0; long = 0; longMs = 0; last = t
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const layer = new TextLayer(document.getElementById('textlayer')!, canvas)
layer.setEnabled(params.get('layer') !== '0')
const lang = params.get('lang') ?? 'ko'
let dict: KoDict | null = null
let statusComposer: StatusComposer | null = null

async function loadKorean() {
  if (lang !== 'ko') return
  try {
    const [en, ko] = await Promise.all([
      fetch('/games/lure/strings.en.json').then(r => r.json()) as Promise<EnDump>,
      fetch('/games/lure/ko.json').then(r => r.json()) as Promise<KoData>,
    ])
    dict = new KoDict(en, ko)
    // S_FOR=35, S_TO=36, S_ON=37 (engines/lure/res_struct.h StringEnum)
    statusComposer = new StatusComposer(dict, en, ko, { for: 35, to: 36, on: 37 })
    layer.setTranslateBlock((lines) => resolveBlock(lines, {
      lookup: (s) => dict!.lookup(s),
      compose: (s) => statusComposer!.compose(s),
      prefix: (s) => dict!.lookupPrefix(s),
      menuItem: (s) => statusComposer!.compose(s, true),
    }))
  } catch (e) { console.warn('[i18n] 한글 데이터 로드 실패, 영문으로 진행', e) }
}

startBtn.disabled = false
startBtn.textContent = '게임 시작'
startBtn.onclick = async () => {
  startBtn.disabled = true
  startBtn.textContent = '엔진 로딩 중…'
  perfProbe()
  await loadKorean()
  await bootEngine({
    canvas,
    engineBase: new URL('engine/', document.baseURI).href,
    args: ['lure'],
    callbacks: {
      onStatus: (t) => { statusEl.textContent = t },
      onReady: () => { startEl.hidden = true; canvas.focus() },
      onFrameText: (recs) => { (window as unknown as { __lureText: unknown }).__lureText = recs; layer.render(recs) },
      onString: (table, local, text, hotspot, char) => { dict?.onString(table, local, text, hotspot, char) },
    },
  })
}
