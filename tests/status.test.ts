import { describe, it, expect } from 'vitest'
import { StatusComposer } from '../src/i18n/status'
import { KoDict } from '../src/i18n/dict'
const list: string[] = new Array(46).fill(''); Object.assign(list, { 0: 'Look at', 1: 'Get', 2: 'Give', 3: ' to ', 4: ' for ', 5: 'Lock', 6: 'Push', 7: 'Tell', 38: 'and then', 39: 'finish', 41: 'You are carrying ', 42: 'nothing', 43: 'You have ', 44: 'groat', 45: 'groats' })
const en = { list, tables: [['Cell door', 'Ratpouch', 'key', 'Lock', 'Bottle', 'Knife', 'Bricks'], [], []] }
const ko = { list: { '0': '{1} 보기', '1': '{1:을} 가져가기', '2': '{2}에게 {1} 주기|주기', '5': '{1:을} 잠그기|잠그기', '6': '{1:을} 밀기|밀기', '7': '{1}에게 지시: {2}|지시하기', '38': '그리고', '39': '끝', '41': '소지품: {1}', '42': '없음', '43': '보유 금액: {1}', '44': '그로트', '45': '그로트' }, t: { '0:0': '감옥 문', '0:1': '랫파우치', '0:2': '열쇠', '0:3': '자물쇠', '0:4': '병', '0:5': '칼', '0:6': '벽돌' } }
describe('StatusComposer', () => {
  const sc = new StatusComposer(new KoDict(en, ko), en, ko, { to: 3, for: 4 })
  it('action + name', () => { expect(sc.compose('Look at Cell door')).toBe('감옥 문 보기') })
  it('action + name + connector + name', () => { expect(sc.compose('Give key to Ratpouch')).toBe('랫파우치에게 열쇠 주기') })
  it('unknown → null', () => { expect(sc.compose('Frobnicate thing')).toBeNull() })
  it('bare name passes through dictionary', () => { expect(sc.compose('Cell door')).toBe('감옥 문') })
  it('applies josa in action templates', () => { expect(sc.compose('Get key')).toBe('열쇠를 가져가기'); expect(sc.compose('Get Cell door')).toBe('감옥 문을 가져가기') })
  it('ambiguous word: name by default, action when preferAction (popup menu)', () => {
    expect(sc.compose('Lock')).toBe('자물쇠'); expect(sc.compose('Lock', true)).toBe('잠그기')
  })
  it('status dialog: carrying items / nothing / groats keep the variable part', () => {
    expect(sc.compose('You are carrying : Bottle, Knife')).toBe('소지품: 병, 칼')
    expect(sc.compose('You are carrying nothing')).toBe('소지품: 없음')
    expect(sc.compose('You have 12 groats')).toBe('보유 금액: 12 그로트')
    expect(sc.compose('You have 1 groat')).toBe('보유 금액: 1 그로트')
  })
  it('Tell: sub-action phrases are composed recursively, and-then/finish translated', () => {
    expect(sc.compose('Tell Ratpouch to Push Bricks')).toBe('랫파우치에게 지시: 벽돌을 밀기')
    expect(sc.compose('Tell Ratpouch to Push Bricks and then Get key and then finish')).toBe('랫파우치에게 지시: 벽돌을 밀기 그리고 열쇠를 가져가기 그리고 끝')
    expect(sc.compose('and then')).toBe('그리고'); expect(sc.compose('finish')).toBe('끝')
  })
  it('bare action label for popup menus', () => { expect(sc.compose('Give')).toBe('주기'); expect(sc.compose('Look at')).toBe('보기') })
})
