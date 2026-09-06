import type { LureTextRecord } from '../engine/types'
export interface TextBlock {
  x: number; y: number; w: number; h: number; pitch: number
  color: [number, number, number]; bg: [number, number, number]
  records: LureTextRecord[]; joined: string
}
/** 같은 x(±1)에서 7~9px 아래로 이어지는 레코드를 한 블록(문단)으로 묶는다. */
export function groupBlocks(records: LureTextRecord[]): TextBlock[] {
  const sorted = [...records].sort((a, b) => a.y - b.y || a.x - b.x)
  const blocks: TextBlock[] = []
  for (const r of sorted) {
    const last = blocks[blocks.length - 1]
    const prev = last?.records[last.records.length - 1]
    if (last && prev && Math.abs(r.x - last.x) <= 1) {
      const dy = r.y - prev.y
      if (dy >= 7 && dy <= 9 && (last.records.length === 1 || dy === last.pitch)) {
        last.records.push(r); last.pitch = dy
        last.w = Math.max(last.w, r.x + r.w - last.x); last.h = r.y + r.h - last.y
        last.joined = last.records.map(k => k.t).join(' ').replace(/\s+/g, ' ').trim()
        continue
      }
    }
    blocks.push({ x: r.x, y: r.y, w: r.w, h: r.h, pitch: 8, color: r.c, bg: r.b, records: [r], joined: r.t.trim() })
  }
  return blocks
}
