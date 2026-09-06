import { describe, it, expect } from 'vitest'
import { layoutKorean, wrapKorean } from '../src/text/kolayout'
const measure = (s: string, px: number) => [...s].reduce((a, ch) => a + (/[가-힣]/.test(ch) ? px : px / 2), 0)
describe('wrapKorean', () => {
  it('wraps at spaces within width', () => {
    expect(wrapKorean('감옥 문은 잠겨 있다', 8 * 6, 8, measure)).toEqual(['감옥 문은', '잠겨 있다'])
  })
  it('breaks a too-long word by character', () => { expect(wrapKorean('가나다라마바사', 8 * 4, 8, measure)).toEqual(['가나다라', '마바사']) })
})
describe('layoutKorean', () => {
  it('prefers the largest font that fits the block height', () => {
    const r = layoutKorean({ x: 81, y: 73, w: 160, h: 15, pitch: 7 }, '문은 잠겨 있다', measure)
    expect(r.fontPx).toBe(10); expect(r.lines).toEqual(['문은 잠겨 있다'])
  })
  it('shrinks font when text needs more lines', () => {
    const r = layoutKorean({ x: 0, y: 0, w: 40, h: 15, pitch: 7 }, '가나다라마바사아자차카타', measure)
    expect(r.fontPx).toBeLessThanOrEqual(8); expect(r.lines.length * r.fontPx).toBeLessThanOrEqual(15 + 6)
  })
})
