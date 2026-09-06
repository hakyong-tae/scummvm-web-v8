import type { EnDump, KoData } from './dict'
import { KoDict, normalizeEn } from './dict'
import { josa } from './josa'

/** 상태줄 "<action> <name>[ <connector> <name2>]" → 액션 템플릿({1},{2})으로 한글 합성 */
export class StatusComposer {
  private actions: { en: string; idx: number }[]
  private connectors: { en: string; key: 'to' | 'for' | 'on' }[]
  constructor(private dict: KoDict, en: EnDump, private ko: KoData, conn: { to?: number; for?: number; on?: number }) {
    this.actions = en.list.map((s, idx) => ({ en: normalizeEn(s), idx }))
      .filter(a => a.en && ko.list[String(a.idx)]).sort((a, b) => b.en.length - a.en.length)
    this.connectors = (['to', 'for', 'on'] as const).filter(k => conn[k] !== undefined)
      .map(k => ({ en: normalizeEn(en.list[conn[k]!]), key: k }))
  }
  compose(line: string): string | null {
    const s = normalizeEn(line)
    const direct = this.dict.lookup(s) ?? (this.dict.koName(s) !== s ? this.dict.koName(s) : null)
    if (direct) return direct
    const act = this.actions.find(a => s === a.en || s.startsWith(a.en + ' ')); if (!act) return null
    const rest = s.slice(act.en.length).trim(); const tpl = this.ko.list[String(act.idx)]
    let n1 = rest, n2 = ''
    for (const c of this.connectors) {
      const i = rest.indexOf(` ${c.en} `)
      if (i > 0) { n1 = rest.slice(0, i); n2 = rest.slice(i + c.en.length + 2); break }
    }
    const [full, bare] = tpl.split('|')
    if (!n1 && !n2) return (bare ?? full.replace(/\{[12](?::[^}]+)?\}/g, '')).replace(/\s+/g, ' ').trim()   // 팝업 메뉴의 단독 액션 라벨
    if (!n2 && full.includes('{2}')) return null
    const k1 = n1 ? this.dict.koName(n1) : '', k2 = n2 ? this.dict.koName(n2) : ''
    return full.replace(/\{([12])(?::([^}]+))?\}/g, (_m, i: string, p?: string) => { const k = i === '1' ? k1 : k2; return p ? josa(k, p) : k })
      .replace(/\s+/g, ' ').trim()
  }
}
