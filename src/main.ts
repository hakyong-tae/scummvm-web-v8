import { bootEngine } from './engine/loader'
import { TextLayer } from './text/layer'
import { KoDict, type EnDump, type KoData } from './i18n/dict'
import { StatusComposer } from './i18n/status'
import { resolveBlock } from './i18n/resolve'
import { assetUrl, GAME_TITLE, AD_PLACEMENT_START, AD_PLACEMENT_QUIT } from './config'
import { TrackpadFSM, attachTrackpad } from './input/trackpad'
import { playInterstitialAd } from './verse8/ads'
import { SaveSyncController } from './save/syncController'
import { openNotice } from './ui/notice'
import { openHints } from './ui/hints'
import { pressKey, typeText } from './input/keys'
import { ui } from './i18n/ui'

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
if (params.get('lang')) localStorage.setItem('lure.lang', params.get('lang')!)   // URL은 초기값만; 이후 토글이 우선
const prefs = {
  get lang() { return localStorage.getItem('lure.lang') ?? 'ko' },
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
// 홍보 녹화 모드: 제목 오버레이, HUD 숨김
const promo = params.get('promo') === '1'
if (promo) { $('promo').classList.add('on') }

// ── 터치(트랙패드) ─────────────────────────────────────────────────────────────
const coarse = matchMedia('(pointer: coarse)').matches || params.get('touch') === '1'
const fsm = new TrackpadFSM({ mode: prefs.touch })
if (coarse) { document.body.classList.add('touch'); $('touchpad').classList.add('on'); attachTrackpad($('touchpad'), canvas, fsm); $('rotate').classList.add('armed') }
// 키보드 전용 입력의 터치 대체: Esc(인트로 스킵/종료), y/n 확인창 버튼, 텍스트 입력(세이브 이름)
$('btnEsc').onclick = () => pressKey(canvas, 'Escape')
$('ynYes').onclick = () => { pressKey(canvas, 'y'); $('yn').hidden = true }
$('ynNo').onclick = () => { pressKey(canvas, 'n'); $('yn').hidden = true }
const kbdInput = $<HTMLInputElement>('kbdInput')
$('btnKbd').onclick = () => { $('kbd').hidden = false; kbdInput.value = ''; kbdInput.focus() }
$('kbdClose').onclick = () => { $('kbd').hidden = true; canvas.focus() }
$('kbdSend').onclick = async () => { await typeText(canvas, kbdInput.value); kbdInput.value = '' }
$('kbdEnter').onclick = () => pressKey(canvas, 'Enter')
$('kbdBack').onclick = () => pressKey(canvas, 'Backspace')
kbdInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); void typeText(canvas, kbdInput.value).then(() => { kbdInput.value = ''; pressKey(canvas, 'Enter') }) } })
/** 엔진 텍스트에서 y/n 확인창을 감지해 터치 버튼 표시(터치 기기만) */
function watchConfirm(recs: { t: string }[]) {
  if (!coarse) return
  const on = recs.some(r => /\(y\/n\)/i.test(r.t))
  $('yn').hidden = !on
}

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
/** 셸 UI 전체를 현재 언어로 다시 채움(data-ui / data-ui-title) */
function applyUiLang() {
  const s = ui(prefs.lang) as unknown as Record<string, string>
  document.documentElement.lang = prefs.lang
  document.querySelectorAll<HTMLElement>('[data-ui]').forEach(el => { const v = s[el.dataset.ui!]; if (typeof v === 'string') el.textContent = v })
  document.querySelectorAll<HTMLElement>('[data-ui-title]').forEach(el => { const v = s[el.dataset.uiTitle!]; if (typeof v === 'string') el.title = v })
  selLang.value = prefs.lang
  if (!startBtn.disabled) startBtn.textContent = s.start
  updateCloudBadge()
}
const syncLangUi = () => applyUiLang()
langBtn.onclick = () => { prefs.lang = prefs.lang === 'ko' ? 'en' : 'ko'; syncLangUi() }
selLang.onchange = () => { prefs.lang = selLang.value; syncLangUi(); void loadKorean() }
selTouch.value = prefs.touch; selTouch.onchange = () => { prefs.touch = selTouch.value as 'trackpad' | 'direct'; fsm.setMode(prefs.touch) }
$('infoBtn').onclick = () => void openNotice(prefs.lang); $('btnInfo').onclick = () => void openNotice(prefs.lang)
$('btnHints').onclick = () => void openHints(prefs.lang)
$('btnSettings').onclick = () => $('settings').classList.toggle('on')

// ── 클라우드 세이브 배지 ──────────────────────────────────────────────────────
const cloudEl = $('cloud')
let cloudState: 'offline' | 'idle' | 'syncing' | 'error' = 'offline'
function updateCloudBadge() {
  const s = ui(prefs.lang); cloudEl.className = cloudState
  cloudEl.textContent = { offline: s.cloudLocal, idle: s.cloudIdle, syncing: s.cloudSyncing, error: s.cloudError }[cloudState]
}
const sync = new SaveSyncController({
  setStatus: (st, detail) => { cloudState = st; updateCloudBadge(); if (detail) cloudEl.title = detail },
  confirmRestore: async (slots) => confirm(ui(prefs.lang).confirmRestore(slots.join(', '))),
})
applyUiLang()   // cloudEl 정의 이후에 최초 적용(TDZ)

function perfProbe() {
  if (!params.has('perf')) return
  let long = 0, longMs = 0
  new PerformanceObserver(l => { for (const e of l.getEntries()) { long++; longMs += e.duration } }).observe({ type: 'longtask', buffered: true })
  let frames = 0, last = performance.now()
  const tick = (t: number) => { frames++; if (t - last >= 5000) { console.log(`[perf] rAF ${(frames / ((t - last) / 1000)).toFixed(1)}/s, longtasks ${long} (${longMs.toFixed(0)}ms)`); frames = 0; long = 0; longMs = 0; last = t } requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
}

// ── 시작 → 광고 → 부팅 ───────────────────────────────────────────────────────
startBtn.disabled = false; startBtn.textContent = ui(prefs.lang).start
startBtn.onclick = async () => {
  startBtn.disabled = true; startBtn.textContent = ui(prefs.lang).preparing
  perfProbe()
  await playInterstitialAd(AD_PLACEMENT_START)
  await loadKorean()
  startBtn.textContent = ui(prefs.lang).loadingEngine
  await bootEngine({
    canvas, engineBase: assetUrl('engine/'), args: ['lure'],
    callbacks: {
      onStatus: (t) => { statusEl.textContent = t },
      onReady: () => { startEl.hidden = true; $('hud').hidden = promo; canvas.focus(); setTimeout(() => void sync.start(), 3000) },
      onFrameText: (recs) => { (window as unknown as { __lureText: unknown }).__lureText = recs; layer.render(recs); watchConfirm(recs) },
      onString: (table, local, text, hotspot, char) => { dict?.onString(table, local, text, hotspot, char) },
      onQuit: async () => { $('hud').hidden = true; await playInterstitialAd(AD_PLACEMENT_QUIT); $('quit').classList.add('on') },
    },
  })
}
$('restartBtn').onclick = () => location.reload()
