// 실제 게임 문자열(strings.en.json)과 번역(ko.json)으로 합성기를 검증한다.
// 단위 테스트의 축소 픽스처가 놓치는 인덱스 어긋남·누락 번역을 여기서 잡는다.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { KoDict, type EnDump, type KoData } from '../src/i18n/dict'
import { StatusComposer } from '../src/i18n/status'

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8')) as T
const en = read<EnDump>('../games/lure/strings.en.json')
const ko = read<KoData>('../games/lure/ko.json')
const sc = new StatusComposer(new KoDict(en, ko), en, ko, { for: 35, to: 36, on: 37 })

describe('real game data', () => {
  it('translates Tell with a sub-action (screenshot case: 랫파우치에게 지시: Push Bricks)', () => {
    const out = sc.compose('Tell Ratpouch to Push Bricks')
    expect(out).toBe('랫파우치에게 지시: 벽돌을 밀기')
    expect(out).not.toMatch(/[A-Za-z]/)
  })
  it('translates chained instructions and the joining words', () => {
    expect(sc.compose('and then')).toBe('그리고')
    expect(sc.compose('finish')).toBe('끝')
    const chained = sc.compose('Tell Ratpouch to Push Bricks and then Get Bottle and then finish')
    expect(chained).toBe('랫파우치에게 지시: 벽돌을 밀기 그리고 병을 가져가기 그리고 끝')
  })
  it('translates plain actions and the status dialog', () => {
    expect(sc.compose('Look at Cell door')).toBe('감옥 문을 보기')   // ko.json list[15] = '{1:을} 보기'
    expect(sc.compose('You are carrying nothing')).toBe('소지품: 없음')
    expect(sc.compose('You have 5 groats')).toBe('보유 금액: 5 그로트')
  })
  it('every popup verb has a bare Korean label', () => {
    for (const verb of ['Look at', 'Get', 'Push', 'Pull', 'Open', 'Close', 'Lock', 'Unlock', 'Talk to', 'Tell', 'Ask', 'Give', 'Use', 'Examine', 'Drink', 'Status']) {
      const out = sc.compose(verb, true)
      expect(out, `verb ${verb}`).toBeTruthy()
      expect(out!, `verb ${verb}`).not.toMatch(/[A-Za-z]/)
    }
  })
})
