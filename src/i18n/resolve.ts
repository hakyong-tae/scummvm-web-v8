export interface ResolveServices {
  lookup: (en: string) => string | null                       // 영문최종(정규화) → 한글
  compose: (en: string) => string | null                      // 상태줄/액션 합성
  prefix: (en: string) => { full: string; ratio: number } | null
}
export type Resolved = { text: string; partial?: number } | { lines: string[] } | null

/** 블록(연속 줄) 번역 결정. 팝업 메뉴·대화 선택지처럼 줄마다 독립된 문자열이면 줄 단위, 아니면 문단 재조립. */
export function resolveBlock(lines: string[], svc: ResolveServices): Resolved {
  const one = (s: string) => svc.lookup(s) ?? svc.compose(s)
  if (lines.length > 1) {
    const per = lines.map(one)
    if (per.every(p => p !== null)) return { lines: per as string[] }
  }
  const joined = lines.join(' ').replace(/\s+/g, ' ').trim()
  const direct = one(joined)
  if (direct) return { text: direct }
  const p = svc.prefix(joined)
  return p ? { text: p.full, partial: p.ratio } : null
}
