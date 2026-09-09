/** ref 기반 사전 — CGE 계열(Soltys/Sfinx)처럼 문자열이 `ref = 평문` 한 벌로 존재하는 엔진용.
 *  Lure의 KoDict와 달리 조사 합성·이름 치환이 없다(상태줄이 합성 문장이 아니라 이름 하나라서). */
export interface RefEnDump { say: Record<string, string> }
export interface RefKoData {
  /** SAY ref → 한글. 줄바꿈은 '\n' */
  t: Record<string, string>
  /** SAY 밖에 있는 스프라이트 이름(상태줄에 뜨는 라벨) 영문 → 한글 */
  names?: Record<string, string>
}

/** 엔진은 '|'와 '\n'에서 줄을 나눠 그리고 레이어는 그 줄들을 공백으로 이어 조회하므로, 둘 다 공백으로 본다. */
export const normalizeRef = (s: string) => s.replace(/[|\n]/g, ' ').replace(/\s+/g, ' ').trim()

export class RefDict {
  private byEn = new Map<string, string>()
  private total = 0
  private translated = 0

  constructor(en: RefEnDump, ko: RefKoData) {
    for (const [ref, enText] of Object.entries(en.say ?? {})) {
      this.total++
      const k = ko.t?.[ref]
      if (!k) continue
      this.translated++
      this.byEn.set(normalizeRef(enText), k)
    }
    for (const [enName, k] of Object.entries(ko.names ?? {})) this.byEn.set(normalizeRef(enName), k)
  }

  lookup(en: string): string | null { return this.byEn.get(normalizeRef(en)) ?? null }

  /** 타이프라이터/부분 출력 대비 — 등록된 영문 중 prefix 일치 → 한글 전체 + 진행 비율 */
  lookupPrefix(enPartial: string): { full: string; ratio: number } | null {
    const p = normalizeRef(enPartial)
    if (!p) return null
    for (const [en, ko] of this.byEn) if (en.startsWith(p) && en !== p) return { full: ko, ratio: p.length / en.length }
    return null
  }

  coverage() { return { total: this.total, translated: this.translated } }
}
