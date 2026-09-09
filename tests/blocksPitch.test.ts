import { describe, it, expect } from 'vitest'
import { groupBlocks } from '../src/text/blocks'
import type { LureTextRecord } from '../src/engine/types'

const rec = (x: number, y: number, t: string): LureTextRecord =>
  ({ x, y, w: 8 * t.length, h: 8, t, c: [0, 0, 0], b: [255, 255, 255] })

describe('groupBlocks line pitch', () => {
  it('groups Lure dialog lines at the default 7~9px pitch', () => {
    const b = groupBlocks([rec(10, 20, 'first'), rec(10, 27, 'second')])
    expect(b).toHaveLength(1)
    expect(b[0].joined).toBe('first second')
  })
  it('does NOT group a 10px pitch with the default range', () => {
    expect(groupBlocks([rec(10, 20, 'first'), rec(10, 30, 'second')])).toHaveLength(2)
  })
  it('groups a 10px pitch when the game says so (CGE kFontHigh+kTextLineSpace)', () => {
    const b = groupBlocks([rec(10, 20, 'first'), rec(10, 30, 'second')], { minPitch: 9, maxPitch: 11 })
    expect(b).toHaveLength(1)
    expect(b[0].joined).toBe('first second')
    expect(b[0].h).toBe(18)
  })
  it('still splits lines that are far apart', () => {
    expect(groupBlocks([rec(10, 20, 'a'), rec(10, 90, 'b')], { minPitch: 9, maxPitch: 11 })).toHaveLength(2)
  })
})
