import { describe, it, expect } from 'vitest'
import { RefDict, normalizeRef } from '../src/i18n/dictRef'

const en = {
  say: {
    '201': "I've had enough of this game!",
    '1005': "Don't come back without Leon, you bumbler!",
    '1006': "Actually I ain't suicidal!|I'll be back with Leon no matter what the cost.",
    '9999': 'Untranslated line',
  },
}
const ko = {
  t: {
    '201': '이 게임 지겹다!',
    '1005': '레온 없이는 돌아올 생각도 마라, 이 얼간아!',
    '1006': '나도 죽고 싶진 않아!\n무슨 수를 써서라도 레온을 데려오지.',
  },
  names: { 'A kennel': '개집', 'A bone': '뼈다귀' },
}

describe('normalizeRef', () => {
  it('treats | and newline as spaces and collapses whitespace', () => {
    expect(normalizeRef('a|b')).toBe('a b')
    expect(normalizeRef('a\nb  c ')).toBe('a b c')
  })
})

describe('RefDict', () => {
  const d = new RefDict(en, ko)
  it('looks a single-line say entry up by its english text', () => {
    expect(d.lookup("I've had enough of this game!")).toBe('이 게임 지겹다!')
  })
  it('matches a multi-line entry against the joined on-screen lines', () => {
    // 엔진은 '|'에서 줄을 나눠 그리고, 레이어는 그 줄들을 공백으로 이어 붙여 조회한다
    expect(d.lookup("Actually I ain't suicidal! I'll be back with Leon no matter what the cost."))
      .toBe('나도 죽고 싶진 않아!\n무슨 수를 써서라도 레온을 데려오지.')
  })
  it('translates sprite names that are not in the SAY table', () => {
    expect(d.lookup('A kennel')).toBe('개집')
  })
  it('returns null for text with no translation', () => {
    expect(d.lookup('Untranslated line')).toBeNull()
    expect(d.lookup('never seen')).toBeNull()
  })
  it('reports coverage over the say table', () => {
    expect(d.coverage()).toEqual({ total: 4, translated: 3 })
  })
  it('prefix lookup returns the full korean and a ratio', () => {
    const r = d.lookupPrefix("I've had enough")
    expect(r?.full).toBe('이 게임 지겹다!')
    expect(r?.ratio).toBeCloseTo(15 / 29, 2)
  })
})
