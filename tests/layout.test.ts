import { describe, it, expect } from 'vitest'
import { toCss } from '../src/text/layout'

describe('toCss', () => {
  const rec = { x: 10, y: 20, w: 40, h: 8, t: 'Hi', c: [1, 2, 3] as [number, number, number], b: [4, 5, 6] as [number, number, number] }
  it('scales 320x200 game coords to the canvas box (3x)', () => {
    expect(toCss(rec, { width: 960, height: 600 })).toEqual({ left: 30, top: 60, width: 120, height: 24, fontPx: 24 })
  })
  it('handles non-integer scale by keeping ratios', () => {
    const r = toCss(rec, { width: 640, height: 300 }) // 2x horizontal, 1.5x vertical
    expect(r).toEqual({ left: 20, top: 30, width: 80, height: 12, fontPx: 12 })
  })
})
