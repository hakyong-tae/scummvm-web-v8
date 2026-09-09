import type { LureTextRecord } from '../engine/types'
export interface TextBlock {
  x: number; y: number; w: number; h: number; pitch: number
  color: [number, number, number]; bg: [number, number, number]
  records: LureTextRecord[]; joined: string
}
/** 줄 간격 범위(게임마다 다름) — Lure 대화창 7px, CGE 10px(kFontHigh+kTextLineSpace) */
export interface PitchRange { minPitch: number; maxPitch: number }
export const DEFAULT_PITCH: PitchRange = { minPitch: 7, maxPitch: 9 }

/** 같은 x(±1)에서 minPitch~maxPitch 아래로 이어지는 레코드를 한 블록(문단)으로 묶는다. */
export function groupBlocks(records: LureTextRecord[], pitch: PitchRange = DEFAULT_PITCH): TextBlock[] {
  const sorted = [...records].sort((a, b) => a.y - b.y || a.x - b.x)
  const blocks: TextBlock[] = []
  for (const r of sorted) {
    const last = blocks[blocks.length - 1]
    const prev = last?.records[last.records.length - 1]
    if (last && prev && Math.abs(r.x - last.x) <= 1) {
      const dy = r.y - prev.y
      if (dy >= pitch.minPitch && dy <= pitch.maxPitch && (last.records.length === 1 || dy === last.pitch)) {
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
