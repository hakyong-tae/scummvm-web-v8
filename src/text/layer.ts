import type { LureTextRecord } from '../engine/types'
import { toCss } from './layout'
import { diffRecords, recordKey } from './diff'
import { groupBlocks, type TextBlock } from './blocks'
import { layoutKorean, type Measure } from './kolayout'

export type Translate = (rec: LureTextRecord) => string
/** 블록(재조립된 영문 문단) → 번역. partial(0~1)은 타이프라이터 진행률 */
import type { Resolved } from '../i18n/resolve'
export type TranslateBlock = (lines: string[], block: TextBlock) => Resolved

/** 엔진 텍스트 레코드를 캔버스 위 DOM으로 렌더. 레코드마다 배경 박스로 엔진 글리프를 덮고,
 *  translateBlock이 있으면 블록 단위로 한글을 재줄바꿈해 그 위에 그린다(없으면 영문 패스스루). */
export class TextLayer {
  private spans = new Map<string, HTMLSpanElement>()
  private koDivs = new Map<string, HTMLDivElement>()
  private current: LureTextRecord[] = []
  private translateBlock: TranslateBlock | null = null
  private measureCtx: CanvasRenderingContext2D | null = null

  constructor(private root: HTMLElement, private canvas: HTMLCanvasElement, private translate: Translate = r => r.t) {
    addEventListener('resize', () => this.relayout())
  }

  setEnabled(on: boolean) { this.root.hidden = !on }
  setTranslateBlock(fn: TranslateBlock | null) { this.translateBlock = fn; this.rerenderAll() }

  /** 엔진이 보고한 이번 프레임의 화면 텍스트 전체 */
  render(next: LureTextRecord[]) {
    const { added, removed } = diffRecords(this.current, next)
    for (const r of removed) { this.spans.get(recordKey(r))?.remove(); this.spans.delete(recordKey(r)) }
    for (const r of added) {
      const el = document.createElement('span')
      el.style.color = `rgb(${r.c.join(',')})`
      el.style.background = `rgb(${r.b.join(',')})`
      this.place(el, r)
      this.root.appendChild(el)
      this.spans.set(recordKey(r), el)
    }
    this.current = next
    this.renderBlocks()
  }

  private renderBlocks() {
    const blocks = groupBlocks(this.current)
    const live = new Set<string>()
    for (const b of blocks) {
      const tr = this.translateBlock?.(b.records.map(r => r.t), b) ?? null
      if (!tr) {
        for (const r of b.records) { const el = this.spans.get(recordKey(r)); if (el) el.textContent = this.translate(r) }
        continue
      }
      for (const r of b.records) { const el = this.spans.get(recordKey(r)); if (el) el.textContent = '' }
      if ('lines' in tr) {
        // 줄 단위(팝업 메뉴·선택지): 레코드마다 자기 자리에
        b.records.forEach((r, i) => {
          const key = `${r.x},${r.y},${r.t}`
          live.add(key)
          const box: TextBlock = { ...b, x: r.x, y: r.y, w: r.w, h: r.h, color: r.c, bg: r.b, records: [r], joined: r.t }   // 줄마다 원래 색(팝업의 '선택 줄=흰색' 강조 유지)
          this.placeKo(this.koDiv(key), box, tr.lines[i], undefined, 0)
        })
        continue
      }
      const key = `${b.x},${b.y},${b.joined}`
      live.add(key)
      this.placeKo(this.koDiv(key), b, tr.text, tr.partial)
    }
    for (const [key, div] of this.koDivs) if (!live.has(key)) { div.remove(); this.koDivs.delete(key) }
  }

  private koDiv(key: string): HTMLDivElement {
    let div = this.koDivs.get(key)
    if (!div) { div = document.createElement('div'); div.className = 'ko'; this.root.appendChild(div); this.koDivs.set(key, div) }
    return div
  }

  private measure: Measure = (text, fontPx) => {
    if (!this.measureCtx) this.measureCtx = document.createElement('canvas').getContext('2d')
    const ctx = this.measureCtx!
    ctx.font = `${fontPx * 10}px NeoDGM, monospace`      // 10배 크기로 재서 정수 반올림 오차 축소
    return ctx.measureText(text).width / 10
  }

  private placeKo(div: HTMLDivElement, b: TextBlock, text: string, partial?: number, slackH = 6) {
    const rect = this.canvas.getBoundingClientRect()
    const sx = rect.width / 320, sy = rect.height / 200
    const lay = layoutKorean(b, text, this.measure, slackH)
    let shown = lay.lines.join('\n')
    if (partial !== undefined && partial < 1) shown = shown.slice(0, Math.round(shown.length * partial))
    div.textContent = shown
    div.style.left = `${b.x * sx}px`
    div.style.top = `${b.y * sy}px`
    div.style.width = `${(b.w + 8) * sx}px`
    div.style.fontSize = `${lay.fontPx * sy}px`
    div.style.lineHeight = `${lay.lineHeight * sy}px`
    div.style.color = `rgb(${b.color.join(',')})`
    div.dataset.font = String(lay.fontPx)
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
    this.renderBlocks()
  }
  private rerenderAll() { this.renderBlocks() }
}
