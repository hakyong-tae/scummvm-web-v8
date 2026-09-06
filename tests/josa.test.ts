import { describe, it, expect } from 'vitest'
import { hasBatchim, josa, applyTemplate } from '../src/i18n/josa'
describe('josa', () => {
  it('detects batchim', () => { expect(hasBatchim('문')).toBe(true); expect(hasBatchim('창문')).toBe(true); expect(hasBatchim('열쇠')).toBe(false) })
  it('picks particle pair', () => {
    expect(josa('창문', '을')).toBe('창문을'); expect(josa('열쇠', '을')).toBe('열쇠를')
    expect(josa('문', '은')).toBe('문은'); expect(josa('열쇠', '은')).toBe('열쇠는')
    expect(josa('문', '이')).toBe('문이'); expect(josa('열쇠', '이')).toBe('열쇠가')
    expect(josa('문', '과')).toBe('문과'); expect(josa('열쇠', '과')).toBe('열쇠와')
    expect(josa('집', '으로')).toBe('집으로'); expect(josa('물', '으로')).toBe('물로'); expect(josa('바다', '으로')).toBe('바다로')
  })
  it('falls back for non-hangul (treat consonant-ending latin as batchim)', () => {
    expect(josa('Skorl', '을')).toBe('Skorl을'); expect(josa('Selena', '을')).toBe('Selena를')
  })
  it('fills template with names and particles', () => {
    expect(applyTemplate('{char:이} {hotspot:을} 살펴본다', { hotspot: '열쇠', char: '디어모트' })).toBe('디어모트가 열쇠를 살펴본다')
    expect(applyTemplate('{hotspot}', { hotspot: '문' })).toBe('문')
    expect(applyTemplate('그냥 텍스트', {})).toBe('그냥 텍스트')
  })
})
