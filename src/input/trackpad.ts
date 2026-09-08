/** 터치 → 가상 커서 상태머신. 순수(DOM 없음) — attachTrackpad()가 어댑터. */
export type TrackpadAction =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'warp'; x: number; y: number }
  | { type: 'click'; button: 0 }
  | { type: 'rdown' }
  | { type: 'rup' }

export interface TrackpadOptions { mode: 'trackpad' | 'direct'; tapMs?: number; longPressMs?: number; tapSlopPx?: number }

export class TrackpadFSM {
  private active = false
  private downAt = 0
  private startX = 0; private startY = 0
  private lastX = 0; private lastY = 0
  private moved = false
  private rightHeld = false
  private readonly tapMs: number; private readonly longPressMs: number; private readonly slop: number
  constructor(private opts: TrackpadOptions) {
    this.tapMs = opts.tapMs ?? 250; this.longPressMs = opts.longPressMs ?? 400; this.slop = opts.tapSlopPx ?? 8
  }
  get mode() { return this.opts.mode }
  setMode(mode: TrackpadOptions['mode']) { this.opts.mode = mode }

  down(x: number, y: number, t: number): TrackpadAction[] {
    this.active = true; this.downAt = t; this.startX = this.lastX = x; this.startY = this.lastY = y
    this.moved = false; this.rightHeld = false
    return this.opts.mode === 'direct' ? [{ type: 'warp', x, y }] : []
  }
  move(x: number, y: number, _t: number): TrackpadAction[] {
    if (!this.active) return []
    const dx = x - this.lastX, dy = y - this.lastY
    this.lastX = x; this.lastY = y
    if (Math.hypot(x - this.startX, y - this.startY) > this.slop) this.moved = true
    if (dx === 0 && dy === 0) return []
    if (this.opts.mode === 'direct' && !this.rightHeld) return [{ type: 'warp', x, y }]
    return [{ type: 'move', dx, dy }]
  }
  /** 주기적으로 호출(또는 longPressMs 타이머에서): 정지 상태로 오래 누르면 우버튼 다운 */
  tick(t: number): TrackpadAction[] {
    if (!this.active || this.rightHeld || this.moved) return []
    if (t - this.downAt >= this.longPressMs) { this.rightHeld = true; return [{ type: 'rdown' }] }
    return []
  }
  up(t: number): TrackpadAction[] {
    if (!this.active) return []
    this.active = false
    if (this.rightHeld) { this.rightHeld = false; return [{ type: 'rup' }] }
    // 움직이지 않고 손을 뗐으면 길이와 무관하게 클릭. (롱프레스는 tick()이 먼저 rdown으로 바꿔 놓는다)
    if (!this.moved) return [{ type: 'click', button: 0 }]
    return []
  }
}

/** 오버레이의 터치 포인터 이벤트를 받아 캔버스에 합성 PointerEvent(pointerType 'mouse')를 디스패치. SDL3 Emscripten은 isTrusted를 보지 않는다. */
export function attachTrackpad(overlay: HTMLElement, canvas: HTMLCanvasElement, fsm: TrackpadFSM) {
  let cx = 0, cy = 0            // 가상 커서(CSS px, viewport 기준)
  let buttons = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const rect = () => canvas.getBoundingClientRect()
  const clamp = () => { const r = rect(); cx = Math.min(Math.max(cx, r.left), r.right - 1); cy = Math.min(Math.max(cy, r.top), r.bottom - 1) }
  // SDL3 Emscripten은 PointerEvent(pointermove/down/up)를 듣는다. MouseEvent 합성은 무시됨(실측).
  const fire = (type: 'pointermove' | 'pointerdown' | 'pointerup', button = 0) => {
    canvas.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: cy, button, buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true }))
  }
  const apply = (actions: TrackpadAction[]) => {
    for (const a of actions) {
      switch (a.type) {
        case 'warp': cx = a.x; cy = a.y; clamp(); fire('pointermove'); break
        case 'move': cx += a.dx; cy += a.dy; clamp(); fire('pointermove'); break
        case 'click':
          buttons = 1; fire('pointerdown', 0)
          setTimeout(() => { buttons = 0; fire('pointerup', 0) }, 70)   // 같은 틱에 up까지 보내면 엔진 폴링이 눌림을 놓칠 수 있음
          break
        case 'rdown': buttons = 2; fire('pointerdown', 2); break
        case 'rup': buttons = 0; fire('pointerup', 2); break
      }
    }
  }
  const stopTimer = () => { if (timer) { clearTimeout(timer); timer = null } }
  // 마우스(하이브리드 기기·데스크톱 ?touch=1)는 오버레이가 삼키지 않고 캔버스로 그대로 전달
  const forward = (e: PointerEvent) => canvas.dispatchEvent(new PointerEvent(e.type, { clientX: e.clientX, clientY: e.clientY, button: e.button, buttons: e.buttons, pointerId: e.pointerId, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true }))
  overlay.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') { forward(e); return }
    e.preventDefault(); overlay.setPointerCapture?.(e.pointerId)
    if (cx === 0 && cy === 0) { const r = rect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2 }
    apply(fsm.down(e.clientX, e.clientY, e.timeStamp))
    stopTimer(); timer = setTimeout(() => apply(fsm.tick(performance.now())), 420)
  })
  overlay.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { forward(e); return } e.preventDefault(); apply(fsm.move(e.clientX, e.clientY, e.timeStamp)) })
  const end = (e: PointerEvent) => { if (e.pointerType === 'mouse') { forward(e); return } e.preventDefault(); stopTimer(); apply(fsm.up(e.timeStamp)) }
  overlay.addEventListener('pointerup', end); overlay.addEventListener('pointercancel', end)
  return { getCursor: () => ({ x: cx, y: cy }) }
}

/** 화면 CSS 좌표에 합성 클릭(pointermove → pointerdown → 70ms → pointerup). 선택지 버튼 등 터치 보조 UI에서 사용. */
export async function clickAtCss(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const ev = (type: string, button: number, buttons: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { clientX, clientY, button, buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true }))
  ev('pointermove', 0, 0)
  await new Promise(r => setTimeout(r, 60))
  ev('pointerdown', 0, 1)
  await new Promise(r => setTimeout(r, 70))
  ev('pointerup', 0, 0)
}
