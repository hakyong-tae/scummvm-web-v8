export type Measure = (text: string, fontPx: number) => number
export interface BlockBox { x: number; y: number; w: number; h: number; pitch: number }
export interface KoLayout { fontPx: number; lines: string[]; lineHeight: number }

export function wrapKorean(text: string, widthPx: number, fontPx: number, measure: Measure): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let cur = ''
    for (const word of para.split(' ')) {
      if (!word) continue
      const cand = cur ? cur + ' ' + word : word
      if (measure(cand, fontPx) <= widthPx) { cur = cand; continue }
      if (cur) lines.push(cur)
      if (measure(word, fontPx) <= widthPx) { cur = word; continue }
      cur = ''
      for (const ch of word) { if (cur && measure(cur + ch, fontPx) > widthPx) { lines.push(cur); cur = '' } cur += ch }
    }
    lines.push(cur)
  }
  return lines
}
/** 영문 블록 박스 안에 들어가는 가장 큰 폰트(게임px)로 재줄바꿈. 폭은 블록 폭 + 8px(말풍선 안쪽 여백). */
export function layoutKorean(box: BlockBox, ko: string, measure: Measure, slackH = 6): KoLayout {
  const width = box.w + 8
  for (const fontPx of [10, 9, 8, 7]) {
    const lines = wrapKorean(ko, width, fontPx, measure)
    if (lines.length * fontPx <= box.h + slackH) return { fontPx, lines, lineHeight: fontPx }
  }
  return { fontPx: 7, lines: wrapKorean(ko, width, 7, measure), lineHeight: 7 }
}
