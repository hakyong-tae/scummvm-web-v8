import { describe, it, expect } from 'vitest'
import { KoDict, normalizeEn } from '../src/i18n/dict'
const en = { list: ['Look at', 'Get', ' for '], tables: [['Cell door', 'The {hotspot} is locked.', 'Skorl'], [], []] }
const ko = { list: { '0': '{1} 보기', '1': '{1} 가져가기' }, t: { '0:0': '감옥 문', '0:1': '{hotspot:은} 잠겨 있다.', '0:2': '스콜' } }
describe('KoDict', () => {
  const d = new KoDict(en, ko)
  it('normalizes whitespace/newlines', () => { expect(normalizeEn('a  b\n\nc ')).toBe('a b c') })
  it('translates a plain string by table:local', () => { expect(d.template(0, 0)).toBe('감옥 문') })
  it('resolves english names to korean via reverse index', () => { expect(d.koName('Cell door')).toBe('감옥 문'); expect(d.koName('Unknown')).toBe('Unknown') })
  it('composes final korean and registers en→ko', () => {
    const out = d.onString(0, 1, 'The Cell door is locked.', 'Cell door', '')
    expect(out).toBe('감옥 문은 잠겨 있다.')
    expect(d.lookup('The Cell door is locked.')).toBe('감옥 문은 잠겨 있다.')
  })
  it('prefix lookup for typewriter partial text', () => {
    d.onString(0, 1, 'The Cell door is locked.', 'Cell door', '')
    const r = d.lookupPrefix('The Cell door is')
    expect(r?.full).toBe('감옥 문은 잠겨 있다.'); expect(r?.ratio).toBeCloseTo(16 / 24, 2)
  })
  it('returns null when no translation', () => { expect(d.onString(1, 5, 'x', '', '')).toBeNull(); expect(d.lookup('x')).toBeNull() })
})
