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
    if (!this.moved && t - this.downAt <= this.tapMs) return [{ type: 'click', button: 0 }]
    if (!this.moved && this.opts.mode === 'direct') return [{ type: 'click', button: 0 }]
    return []
  }
}

/** 오버레이의 포인터 이벤트를 받아 캔버스에 합성 MouseEvent를 디스패치. SDL3 Emscripten은 isTrusted를 보지 않는다. */
export function attachTrackpad(overlay: HTMLElement, canvas: HTMLCanvasElement, fsm: TrackpadFSM) {
  let cx = 0, cy = 0            // 가상 커서(CSS px, viewport 기준)
  let buttons = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const rect = () => canvas.getBoundingClientRect()
  const clamp = () => { const r = rect(); cx = Math.min(Math.max(cx, r.left), r.right - 1); cy = Math.min(Math.max(cy, r.top), r.bottom - 1) }
  const fire = (type: string, button = 0) => {
    canvas.dispatchEvent(new MouseEvent(type, { clientX: cx, clientY: cy, button, buttons, bubbles: true, cancelable: true }))
  }
  const apply = (actions: TrackpadAction[]) => {
    for (const a of actions) {
      switch (a.type) {
        case 'warp': cx = a.x; cy = a.y; clamp(); fire('mousemove'); break
        case 'move': cx += a.dx; cy += a.dy; clamp(); fire('mousemove'); break
        case 'click': buttons = 1; fire('mousedown', 0); buttons = 0; fire('mouseup', 0); break
        case 'rdown': buttons = 2; fire('mousedown', 2); break
        case 'rup': buttons = 0; fire('mouseup', 2); break
      }
    }
  }
  const stopTimer = () => { if (timer) { clearTimeout(timer); timer = null } }
  overlay.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return
    e.preventDefault(); overlay.setPointerCapture?.(e.pointerId)
    if (cx === 0 && cy === 0) { const r = rect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2 }
    apply(fsm.down(e.clientX, e.clientY, e.timeStamp))
    stopTimer(); timer = setTimeout(() => apply(fsm.tick(performance.now())), 420)
  })
  overlay.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') return; e.preventDefault(); apply(fsm.move(e.clientX, e.clientY, e.timeStamp)) })
  const end = (e: PointerEvent) => { if (e.pointerType === 'mouse') return; e.preventDefault(); stopTimer(); apply(fsm.up(e.timeStamp)) }
  overlay.addEventListener('pointerup', end); overlay.addEventListener('pointercancel', end)
  return { getCursor: () => ({ x: cx, y: cy }) }
}
