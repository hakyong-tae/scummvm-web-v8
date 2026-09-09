import { bootEngine } from './engine/loader'
import { TextLayer } from './text/layer'
import { KoDict, type EnDump, type KoData } from './i18n/dict'
import { StatusComposer } from './i18n/status'
import { resolveBlock } from './i18n/resolve'
import { assetUrl, GAME_TITLE, AD_PLACEMENT_START, AD_PLACEMENT_QUIT } from './config'
import { TrackpadFSM, attachTrackpad, clickAtCss } from './input/trackpad'
import { playInterstitialAd } from './verse8/ads'
import { SaveSyncController } from './save/syncController'
import { openNotice } from './ui/notice'
import { openHints } from './ui/hints'
import { pressKey, typeText, nextChoiceIndex } from './input/keys'
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
/** 대화 선택지(TALK_SELECT: 화면 x=0, y=8·16·…의 줄들, hotspots.cpp:3537)를 감지해 터치 기기에서 탭 가능한 버튼으로 강조 */
const choicesEl = $('choices')
let choicesKey = ''
let talkChoiceLines: { y: number; t: string }[] = []   // PC 키보드 선택용
let popupLines: number[] = []                            // 동작 팝업(x=12 줄들) 감지
let choiceIdx = -1
/** 엔진이 알려주는 UI 상태(webtext.cpp emitState). 세이브 창처럼 엔진이 키보드를 쓰는 동안은 우리가 끼어들지 않는다. */
const engineState = () => {
  const M = (window.Module ?? {}) as Record<string, unknown>
  return { talkSelect: M.lureTalkSelect === 1, popup: M.lurePopup === 1, modal: M.lureModal === 1 }
}
function watchTalkChoices(recs: { x: number; y: number; w: number; h: number; t: string }[]) {
  const st = engineState()
  popupLines = st.popup ? recs.filter(r => r.x === 12 && r.w > 0).map(r => r.y) : []
  const head = recs.find(r => r.x === 0 && r.y === 0)
  const lines = recs.filter(r => r.x === 0 && r.y >= 8 && r.y <= 40 && r.y % 8 === 0 && r.w > 0).sort((a, b) => a.y - b.y)
  const isTalk = st.talkSelect && !!head && /^(Talk to|Ask|Tell)\b/.test(head.t) && lines.length > 0
  const key = isTalk ? lines.map(l => `${l.y}:${l.t}`).join('|') : ''
  const nextLines = isTalk ? lines.map(l => ({ y: l.y, t: l.t })) : []
  if (nextLines.length !== talkChoiceLines.length) choiceIdx = -1
  talkChoiceLines = nextLines
  if (!coarse) return
  if (key === choicesKey) return
  choicesKey = key
  choicesEl.innerHTML = ''
  if (!isTalk) return
  const rect = canvas.getBoundingClientRect(); const sx = rect.width / 320, sy = rect.height / 200
  // 엔진 줄(8px 피치)은 손가락엔 너무 촘촘 → 상태줄 아래부터 넉넉한 간격으로 세로 나열. 탭 시 클릭은 원래 줄 위치로 보낸다.
  const hgt = Math.max(8 * sy, 30), gap = 6, startTop = 8 * sy + 4
  lines.forEach((l, i) => {
    const b = document.createElement('button')
    b.textContent = dict?.lookup(l.t) ?? l.t
    b.style.left = `${2 * sx}px`; b.style.top = `${startTop + i * (hgt + gap)}px`; b.style.height = `${hgt}px`
    b.style.fontSize = `${Math.min(Math.max(8 * sy * 0.9, 14), 22)}px`; b.style.animationDelay = `${i * 0.15}s`
    b.onclick = async (e) => { e.preventDefault(); await clickAtCss(canvas, rect.left + 40 * sx, rect.top + (l.y + 4) * sy) }
    choicesEl.appendChild(b)
  })
  if (!localStorage.getItem('lure.toast.choices')) {
    const t = $('toast'); t.textContent = ui(prefs.lang).choicesHint; t.hidden = false
    setTimeout(() => { t.hidden = true; localStorage.setItem('lure.toast.choices', '1') }, 6000)
  }
}
// PC 키보드: 대화 선택지는 엔진이 마우스 y로 고르므로 ↑↓를 합성 포인터 이동으로, 동작 팝업은 휠 이벤트로 바꾼다. Enter = 합성 좌클릭.
let lastMouse = { x: 0, y: 0 }
addEventListener('pointermove', e => { if (e.isTrusted && e.pointerType === 'mouse') lastMouse = { x: e.clientX, y: e.clientY } })
function pointerTo(clientX: number, clientY: number) {
  canvas.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true }))
}
document.addEventListener('keydown', (e) => {
  if (coarse || startEl.hidden === false) return
  if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
  if (engineState().modal) return       // 세이브 이름 입력 등 엔진이 키보드를 쓰는 중
  const dir = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
  const rect = canvas.getBoundingClientRect(); const sx = rect.width / 320, sy = rect.height / 200
  if (talkChoiceLines.length) {
    if (dir) {
      choiceIdx = nextChoiceIndex(choiceIdx, dir as -1 | 1, talkChoiceLines.length)
      pointerTo(rect.left + 40 * sx, rect.top + (talkChoiceLines[choiceIdx].y + 4) * sy); e.preventDefault()
    } else if (e.key === 'Enter') {
      if (choiceIdx < 0) choiceIdx = 0
      void clickAtCss(canvas, rect.left + 40 * sx, rect.top + (talkChoiceLines[choiceIdx].y + 4) * sy); e.preventDefault()
    }
  } else if (popupLines.length) {
    if (dir) {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: dir * 100, deltaMode: 0, clientX: lastMouse.x, clientY: lastMouse.y, bubbles: true, cancelable: true })); e.preventDefault()
    } else if (e.key === 'Enter') { void clickAtCss(canvas, lastMouse.x, lastMouse.y); e.preventDefault() }
  }
})
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
  $('controlsHelp').textContent = coarse ? s.touchHelp : s.pcHelp
  updateCloudBadge()
}
/** 부팅 후 1회 조작 안내 토스트(기기별 저장) */
function showControlsToast() {
  if (localStorage.getItem('lure.toast.controls')) return
  const t = $('toast'); const s = ui(prefs.lang)
  t.textContent = `${s.controlsTitle}: ${coarse ? s.touchHelp : s.pcHelp}`; t.hidden = false
  setTimeout(() => { t.hidden = true; localStorage.setItem('lure.toast.controls', '1') }, 9000)
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
      onReady: () => { startEl.hidden = true; $('hud').hidden = promo; canvas.focus(); if (params.get('debug') === '1') (window.Module as Record<string, unknown>).lureDebug = true; setTimeout(() => void sync.start(), 3000); if (!promo) setTimeout(showControlsToast, 2500) },
      onFrameText: (recs) => { (window as unknown as { __lureText: unknown }).__lureText = recs; layer.render(recs); watchConfirm(recs); watchTalkChoices(recs) },
      onString: (table, local, text, hotspot, char) => { dict?.onString(table, local, text, hotspot, char) },
      onQuit: async () => { $('hud').hidden = true; await playInterstitialAd(AD_PLACEMENT_QUIT); $('quit').classList.add('on') },
    },
  })
}
$('restartBtn').onclick = () => location.reload()
