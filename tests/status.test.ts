import { describe, it, expect } from 'vitest'
import { StatusComposer } from '../src/i18n/status'
import { KoDict } from '../src/i18n/dict'
const en = { list: ['Look at', 'Get', 'Give', ' to ', ' for '], tables: [['Cell door', 'Ratpouch', 'key'], [], []] }
const ko = { list: { '0': '{1} 보기', '1': '{1} 가져가기', '2': '{2}에게 {1} 주기' }, t: { '0:0': '감옥 문', '0:1': '랫파우치', '0:2': '열쇠' } }
describe('StatusComposer', () => {
  const sc = new StatusComposer(new KoDict(en, ko), en, ko, { to: 3, for: 4 })
  it('action + name', () => { expect(sc.compose('Look at Cell door')).toBe('감옥 문 보기') })
  it('action + name + connector + name', () => { expect(sc.compose('Give key to Ratpouch')).toBe('랫파우치에게 열쇠 주기') })
  it('unknown → null', () => { expect(sc.compose('Frobnicate thing')).toBeNull() })
  it('bare name passes through dictionary', () => { expect(sc.compose('Cell door')).toBe('감옥 문') })
})
