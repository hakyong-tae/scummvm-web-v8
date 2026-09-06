import { describe, it, expect } from 'vitest'
import { groupBlocks } from '../src/text/blocks'
const R = (x: number, y: number, t: string, c = 125) => ({ x, y, w: 5 * t.length, h: 8, t, c: [c, c, c] as [number, number, number], b: [0, 0, 0] as [number, number, number] })
describe('groupBlocks', () => {
  it('joins consecutive lines at same x with 7px pitch', () => {
    const b = groupBlocks([R(81, 73, 'It must be bolted from the other'), R(81, 80, 'side.'), R(0, 0, 'Lock Cell door')])
    expect(b).toHaveLength(2)
    const dlg = b.find(k => k.records.length === 2)!
    expect(dlg.joined).toBe('It must be bolted from the other side.'); expect(dlg.x).toBe(81); expect(dlg.y).toBe(73); expect(dlg.pitch).toBe(7)
    expect(dlg.w).toBe(5 * 'It must be bolted from the other'.length); expect(dlg.h).toBe(15)
  })
  it('keeps 8px pitch and splits on x change (talk name header)', () => {
    const b = groupBlocks([R(120, 60, 'Ratpouch', 255), R(70, 70, 'Hello there,'), R(70, 78, 'stranger.')])
    expect(b.map(k => k.joined)).toEqual(['Ratpouch', 'Hello there, stranger.'])
  })
  it('does not merge lines farther than 9px apart', () => {
    expect(groupBlocks([R(10, 10, 'a'), R(10, 30, 'b')])).toHaveLength(2)
  })
})
