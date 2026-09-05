import { describe, it, expect } from 'vitest'
import { diffRecords, recordKey } from '../src/text/diff'

const mk = (x: number, y: number, t: string) =>
  ({ x, y, w: 8 * t.length, h: 8, t, c: [0, 0, 0] as [number, number, number], b: [1, 1, 1] as [number, number, number] })

describe('diffRecords', () => {
  it('keys by position+text', () => {
    expect(recordKey(mk(1, 2, 'a'))).toBe('1,2,a')
  })
  it('splits into added / removed / kept', () => {
    const prev = [mk(0, 0, 'a'), mk(0, 8, 'b')]
    const next = [mk(0, 8, 'b'), mk(0, 16, 'c')]
    const d = diffRecords(prev, next)
    expect(d.removed.map(recordKey)).toEqual(['0,0,a'])
    expect(d.added.map(recordKey)).toEqual(['0,16,c'])
    expect(d.kept.map(recordKey)).toEqual(['0,8,b'])
  })
  it('treats a typewriter-grown line as replace (remove old, add new)', () => {
    const d = diffRecords([mk(0, 0, 'Hel')], [mk(0, 0, 'Hello')])
    expect(d.removed).toHaveLength(1); expect(d.added).toHaveLength(1)
  })
})
