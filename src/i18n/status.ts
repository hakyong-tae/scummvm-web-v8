import type { EnDump, KoData } from './dict'
import { KoDict, normalizeEn } from './dict'
import { josa } from './josa'

/** 상태줄 "<action> <name>[ <connector> <name2>]" → 액션 템플릿({1},{2})으로 한글 합성 */
export class StatusComposer {
  private actions: { en: string; idx: number }[]
  private connectors: { en: string; key: 'to' | 'for' | 'on' }[]
  private en: EnDump
  private fixedWords = new Map<string, string>()   // "and then"→"그리고", "finish"→"끝" 등 (list idx≥25, 플레이스홀더 없는 항목)
  private andThen = ''
  constructor(private dict: KoDict, en: EnDump, private ko: KoData, conn: { to?: number; for?: number; on?: number }) {
    this.en = en
    // Action enum 범위(index 0..24)만 동작 단어. 그 뒤(S_* 고정 문구)는 composeFixed가 따로 처리한다.
    this.actions = en.list.slice(0, 25).map((s, idx) => ({ en: normalizeEn(s), idx }))
      .filter(a => a.en && ko.list[String(a.idx)]).sort((a, b) => b.en.length - a.en.length)
    this.connectors = (['to', 'for', 'on'] as const).filter(k => conn[k] !== undefined)
      .map(k => ({ en: normalizeEn(en.list[conn[k]!]), key: k }))
    en.list.forEach((w, idx) => { const k = ko.list[String(idx)]; if (idx >= 25 && w.trim() && k && !/\{[12]/.test(k)) this.fixedWords.set(normalizeEn(w), k) })
    this.andThen = normalizeEn(en.list[38] ?? 'and then')
  }
  /** 이름 자리에 온 문구를 한글로: 이름 사전 → 하위 액션 문장 재귀 합성("Push Bricks and then finish") → 원문 */
  private koPhrase(phrase: string): string {
    const direct = this.dict.koName(phrase); if (direct !== phrase) return direct
    const parts = this.andThen ? phrase.split(new RegExp(`\\s+${this.andThen}\\s+`)) : [phrase]
    const out = parts.map(seg => { const t = seg.trim(); if (!t) return ''; return this.fixedWords.get(t) ?? this.compose(t) ?? this.dict.koName(t) })
    const joiner = this.fixedWords.get(this.andThen) ?? this.andThen
    return out.filter(Boolean).join(` ${joiner} `)
  }
  /** preferAction: 팝업 메뉴 항목처럼 액션 단어가 확실한 문맥("Lock"=잠그기 vs 사물 "자물쇠") */
  private bareLabel(idx: number): string {
    const [full, bare] = this.ko.list[String(idx)].split('|')
    return (bare ?? full.replace(/\{[12](?::[^}]+)?\}/g, '')).replace(/\s+/g, ' ').trim()
  }
  compose(line: string, preferAction = false): string | null {
    const s = normalizeEn(line)
    const fixed = this.composeFixed(s); if (fixed) return fixed
    const word = this.fixedWords.get(s); if (word) return word
    const exactAction = this.actions.find(a => s === a.en)
    if (preferAction && exactAction) return this.bareLabel(exactAction.idx)
    const direct = this.dict.lookup(s) ?? (this.dict.koName(s) !== s ? this.dict.koName(s) : null)
    if (direct) return direct
    const act = exactAction ?? this.actions.find(a => s.startsWith(a.en + ' ')); if (!act) return null
    const rest = s.slice(act.en.length).trim(); const tpl = this.ko.list[String(act.idx)]
    let n1 = rest, n2 = ''
    for (const c of this.connectors) {
      const i = rest.indexOf(` ${c.en} `)
      if (i > 0) { n1 = rest.slice(0, i); n2 = rest.slice(i + c.en.length + 2); break }
    }
    const [full] = tpl.split('|')
    if (!n1 && !n2) return this.bareLabel(act.idx)
    if (!n2 && full.includes('{2}')) return null
    const k1 = n1 ? this.koPhrase(n1) : '', k2 = n2 ? this.koPhrase(n2) : ''
    return full.replace(/\{([12])(?::([^}]+))?\}/g, (_m, i: string, p?: string) => { const k = i === '1' ? k1 : k2; return p ? josa(k, p) : k })
      .replace(/\s+/g, ' ').trim()
  }

  /** 상태창 고정 문구(hotspots.cpp doShowStatus): "You are carrying : a, b" / "You are carrying nothing" / "You have 12 groats" */
  private composeFixed(s: string): string | null {
    const L = (i: number) => normalizeEn(this.en.list[i] ?? '')
    const K = (i: number) => this.ko.list[String(i)]
    const carrying = L(41), nothing = L(42), have = L(43)
    if (carrying && K(41) && (s === carrying || s.startsWith(carrying + ' ') || s.startsWith(carrying + ':'))) {
      const rest = s.slice(carrying.length).replace(/^\s*:\s*/, '').trim()
      const items = !rest || rest === nothing ? (K(42) ?? rest) : rest.split(/,\s*/).map(n => this.dict.koName(n)).join(', ')
      return K(41).includes('{1}') ? K(41).replace('{1}', items) : `${K(41)}${items}`
    }
    if (have && K(43) && s.startsWith(have + ' ')) {
      let rest = s.slice(have.length).trim()
      for (const i of [45, 44]) { const w = L(i); if (w && K(i)) rest = rest.replace(new RegExp(`\\b${w}\\b`), K(i)) }
      return K(43).includes('{1}') ? K(43).replace('{1}', rest) : `${K(43)}${rest}`
    }
    return null
  }
}
