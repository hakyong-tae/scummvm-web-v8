import { bootEngine } from './engine/loader'
import { TextLayer } from './text/layer'
import { KoDict, type EnDump, type KoData } from './i18n/dict'
import { StatusComposer } from './i18n/status'
import { resolveBlock } from './i18n/resolve'
import { assetUrl, GAME_TITLE, AD_PLACEMENT_START, AD_PLACEMENT_QUIT } from './config'
import { TrackpadFSM, attachTrackpad } from './input/trackpad'
import { showInterstitial } from './verse8/ads'
import { SaveSyncController } from './save/syncController'
import { openNotice } from './ui/notice'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// SDL3(Emscripten)가 클릭 시 requestPointerLock()을 시도하고 iframe/헤드리스에서 거부되면 미처리 rejection을 남긴다.
// 게임 동작과 무관한 소음이라 이 메시지만 삼킨다(다른 오류는 그대로).
addEventListener('unhandledrejection', (e) => {
  const msg = String((e.reason && (e.reason as Error).message) ?? e.reason ?? '')
  if (/pointer lock/i.test(msg)) e.preventDefault()
})
const canvas = $<HTMLCanvasElement>('canvas')
const frame = $('frame'), startEl = $('start'), startBtn = $<HTMLButtonElement>('startBtn'), statusEl = $('status')
const params = new URLSearchParams(location.search)
const GAME_W = 320, GAME_H = 200

// ── 설정(로컬 저장) ──────────────────────────────────────────────────────────
const prefs = {
  get lang() { return params.get('lang') ?? localStorage.getItem('lure.lang') ?? 'ko' },
  set lang(v: string) { localStorage.setItem('lure.lang', v) },
  get touch() { return (localStorage.getItem('lure.touch') as 'trackpad' | 'direct') ?? 'trackpad' },
  set touch(v: 'trackpad' | 'direct') { localStorage.setItem('lure.touch', v) },
}
document.title = GAME_TITLE
$('title').textContent = 'Lure of the Temptress'

// ── 캔버스 맞춤: contain(소수 배율) — 폰 가로에서 정수배는 화면을 절반도 못 채움 ──
function fitCanvas() {
  const k = Math.min(innerWidth / GAME_W, innerHeight / GAME_H)
  canvas.style.width = frame.style.width = `${Math.floor(GAME_W * k)}px`
  canvas.style.height = frame.style.height = `${Math.floor(GAME_H * k)}px`
}
addEventListener('resize', fitCanvas); fitCanvas()

// ── 터치(트랙패드) ─────────────────────────────────────────────────────────────
const coarse = matchMedia('(pointer: coarse)').matches || params.get('touch') === '1'
const fsm = new TrackpadFSM({ mode: prefs.touch })
if (coarse) { $('touchpad').classList.add('on'); attachTrackpad($('touchpad'), canvas, fsm); $('rotate').classList.add('armed') }

// ── 텍스트 레이어 + 한글 ─────────────────────────────────────────────────────
const layer = new TextLayer($('textlayer'), canvas)
layer.setEnabled(params.get('layer') !== '0')
let dict: KoDict | null = null
let statusComposer: StatusComposer | null = null
async function loadKorean() {
  if (prefs.lang !== 'ko') { layer.setTranslateBlock(null); return }
  try {
    const [en, ko] = await Promise.all([
      fetch(assetUrl('games/lure/strings.en.json')).then(r => r.json()) as Promise<EnDump>,
      fetch(assetUrl('games/lure/ko.json')).then(r => r.json()) as Promise<KoData>,
    ])
    dict = new KoDict(en, ko)
    statusComposer = new StatusComposer(dict, en, ko, { for: 35, to: 36, on: 37 })  // res_struct.h StringEnum
    layer.setTranslateBlock((lines) => resolveBlock(lines, {
      lookup: (s) => dict!.lookup(s), compose: (s) => statusComposer!.compose(s),
      prefix: (s) => dict!.lookupPrefix(s), menuItem: (s) => statusComposer!.compose(s, true),
    }))
  } catch (e) { console.warn('[i18n] 한글 데이터 로드 실패, 영문으로 진행', e) }
}

// ── 타이틀 화면 UI ───────────────────────────────────────────────────────────
const langBtn = $<HTMLButtonElement>('langBtn'), selLang = $<HTMLSelectElement>('selLang'), selTouch = $<HTMLSelectElement>('selTouch')
const syncLangUi = () => { langBtn.textContent = prefs.lang === 'ko' ? '자막: 한국어' : 'Subtitles: English'; selLang.value = prefs.lang }
langBtn.onclick = () => { prefs.lang = prefs.lang === 'ko' ? 'en' : 'ko'; syncLangUi() }
selLang.onchange = () => { prefs.lang = selLang.value; syncLangUi(); void loadKorean() }
selTouch.value = prefs.touch; selTouch.onchange = () => { prefs.touch = selTouch.value as 'trackpad' | 'direct'; fsm.setMode(prefs.touch) }
$('infoBtn').onclick = () => void openNotice(); $('btnInfo').onclick = () => void openNotice()
$('btnSettings').onclick = () => $('settings').classList.toggle('on')
syncLangUi()

// ── 클라우드 세이브 배지 ──────────────────────────────────────────────────────
const cloudEl = $('cloud')
const sync = new SaveSyncController({
  setStatus: (s, detail) => { cloudEl.className = s; cloudEl.textContent = `저장: ${{ offline: '로컬', idle: '클라우드', syncing: '동기화 중', error: '오류' }[s]}`; if (detail) cloudEl.title = detail },
  confirmRestore: async (slots) => confirm(`다른 기기의 세이브가 더 최신입니다.\n(${slots.join(', ')})\n클라우드 세이브를 불러올까요? 취소하면 이 기기의 세이브를 유지하고 업로드합니다.`),
})

function perfProbe() {
  if (!params.has('perf')) return
  let long = 0, longMs = 0
  new PerformanceObserver(l => { for (const e of l.getEntries()) { long++; longMs += e.duration } }).observe({ type: 'longtask', buffered: true })
  let frames = 0, last = performance.now()
  const tick = (t: number) => { frames++; if (t - last >= 5000) { console.log(`[perf] rAF ${(frames / ((t - last) / 1000)).toFixed(1)}/s, longtasks ${long} (${longMs.toFixed(0)}ms)`); frames = 0; long = 0; longMs = 0; last = t } requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
}

// ── 시작 → 광고 → 부팅 ───────────────────────────────────────────────────────
startBtn.disabled = false; startBtn.textContent = '게임 시작'
startBtn.onclick = async () => {
  startBtn.disabled = true; startBtn.textContent = '준비 중…'
  perfProbe()
  await showInterstitial(AD_PLACEMENT_START)
  await loadKorean()
  startBtn.textContent = '엔진 로딩 중…'
  await bootEngine({
    canvas, engineBase: assetUrl('engine/'), args: ['lure'],
    callbacks: {
      onStatus: (t) => { statusEl.textContent = t },
      onReady: () => { startEl.hidden = true; $('hud').hidden = false; canvas.focus(); setTimeout(() => void sync.start(), 3000) },
      onFrameText: (recs) => { (window as unknown as { __lureText: unknown }).__lureText = recs; layer.render(recs) },
      onString: (table, local, text, hotspot, char) => { dict?.onString(table, local, text, hotspot, char) },
      onQuit: async () => { $('hud').hidden = true; await showInterstitial(AD_PLACEMENT_QUIT); $('quit').classList.add('on') },
    },
  })
}
$('restartBtn').onclick = () => location.reload()
