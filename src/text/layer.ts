import type { LureTextRecord } from '../engine/types'
import { toCss } from './layout'
import { diffRecords, recordKey } from './diff'

export type Translate = (rec: LureTextRecord) => string

/** 엔진 텍스트 레코드를 캔버스 위 DOM span으로 렌더. 배경색 박스로 엔진 글리프를 덮는다. */
export class TextLayer {
  private spans = new Map<string, HTMLSpanElement>()
  private current: LureTextRecord[] = []

  constructor(private root: HTMLElement, private canvas: HTMLCanvasElement, private translate: Translate = r => r.t) {
    addEventListener('resize', () => this.relayout())
  }

  setEnabled(on: boolean) { this.root.hidden = !on }

  /** 엔진이 보고한 이번 프레임의 화면 텍스트 전체 */
  render(next: LureTextRecord[]) {
    const { added, removed } = diffRecords(this.current, next)
    for (const r of removed) { this.spans.get(recordKey(r))?.remove(); this.spans.delete(recordKey(r)) }
    for (const r of added) {
      const el = document.createElement('span')
      el.textContent = this.translate(r)
      el.style.color = `rgb(${r.c.join(',')})`
      el.style.background = `rgb(${r.b.join(',')})`
      this.place(el, r)
      this.root.appendChild(el)
      this.spans.set(recordKey(r), el)
    }
    this.current = next
  }

  private place(el: HTMLSpanElement, r: LureTextRecord) {
    const box = toCss(r, this.canvas.getBoundingClientRect())
    el.style.left = `${box.left}px`
    el.style.top = `${box.top}px`
    el.style.minWidth = `${box.width}px`
    el.style.height = `${box.height}px`
    el.style.fontSize = `${box.fontPx}px`
  }

  private relayout() {
    for (const r of this.current) { const el = this.spans.get(recordKey(r)); if (el) this.place(el, r) }
  }
}
