import { applyTemplate } from './josa'
export interface EnDump { list: string[]; tables: string[][] }
export interface KoData { list: Record<string, string>; t: Record<string, string> }
export const normalizeEn = (s: string) => s.replace(/\s+/g, ' ').trim()

/** ko.json 사전 + 엔진 getString 훅으로 채워지는 영문최종→한글최종 런타임 맵 */
export class KoDict {
  private byEn = new Map<string, string>()
  private nameIndex = new Map<string, string>()
  constructor(en: EnDump, private ko: KoData) {
    en.tables.forEach((tbl, t) => tbl.forEach((s, i) => {
      const k = ko.t[`${t}:${i}`]
      if (k && !s.includes('{') && !k.includes('{')) this.nameIndex.set(normalizeEn(s), k)
    }))
  }
  template(table: number, local: number): string | null { return this.ko.t[`${table}:${local}`] ?? null }
  listKo(index: number): string | null { return this.ko.list[String(index)] ?? null }
  koName(enName: string): string { return this.nameIndex.get(normalizeEn(enName)) ?? enName }
  /** 엔진 getString 훅: 한글최종을 만들고 등록. 번역 없으면 null */
  onString(table: number, local: number, enFinal: string, hotspot: string, char: string): string | null {
    const tpl = this.template(table, local); if (!tpl) return null
    const out = applyTemplate(tpl, { hotspot: hotspot ? this.koName(hotspot) : '', char: char ? this.koName(char) : '' })
    this.byEn.set(normalizeEn(enFinal), out)
    return out
  }
  lookup(enJoined: string): string | null { return this.byEn.get(normalizeEn(enJoined)) ?? null }
  /** 타이프라이터 부분 문자열: 등록된 영문 중 prefix 일치 → 한글 전체 + 진행 비율 */
  lookupPrefix(enPartial: string): { full: string; ratio: number } | null {
    const p = normalizeEn(enPartial); if (!p) return null
    for (const [en, ko] of this.byEn) if (en.startsWith(p) && en !== p) return { full: ko, ratio: p.length / en.length }
    return null
  }
}
