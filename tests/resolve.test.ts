import { describe, it, expect } from 'vitest'
import { resolveBlock } from '../src/i18n/resolve'
const svc = {
  lookup: (s: string) => ({ 'Hello there, stranger.': '안녕, 낯선 이.', 'Yes.': '그래.', 'No.': '아니.' } as Record<string, string>)[s] ?? null,
  compose: (s: string) => ({ Close: '닫기', Lock: '잠그기', Open: '열기', 'Look at Cell door': '감옥 문 보기' } as Record<string, string>)[s] ?? null,
  prefix: (s: string) => s === 'Hello there,' ? { full: '안녕, 낯선 이.', ratio: 0.5 } : null,
}
describe('resolveBlock', () => {
  it('menu items: every line resolves on its own → per-line', () => {
    expect(resolveBlock(['Close', 'Lock', 'Open'], svc)).toEqual({ lines: ['닫기', '잠그기', '열기'] })
  })
  it('talk choices: full sentences per line → per-line', () => {
    expect(resolveBlock(['Yes.', 'No.'], svc)).toEqual({ lines: ['그래.', '아니.'] })
  })
  it('wrapped paragraph → joined lookup', () => {
    expect(resolveBlock(['Hello there,', 'stranger.'], svc)).toEqual({ text: '안녕, 낯선 이.' })
  })
  it('typewriter partial → prefix with ratio', () => {
    expect(resolveBlock(['Hello there,'], svc)).toEqual({ text: '안녕, 낯선 이.', partial: 0.5 })
  })
  it('single status line → compose', () => { expect(resolveBlock(['Look at Cell door'], svc)).toEqual({ text: '감옥 문 보기' }) })
  it('nothing known → null', () => { expect(resolveBlock(['Frob', 'nicate'], svc)).toBeNull() })
})
