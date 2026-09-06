const PAIRS: Record<string, [string, string]> = {
  '을': ['을', '를'], '를': ['을', '를'], '은': ['은', '는'], '는': ['은', '는'], '이': ['이', '가'], '가': ['이', '가'],
  '과': ['과', '와'], '와': ['과', '와'], '으로': ['으로', '로'], '로': ['으로', '로'], '아': ['아', '야'], '야': ['아', '야'],
}
const HANGUL = (code: number) => code >= 0xac00 && code <= 0xd7a3

/** 마지막 글자의 받침 유무. 영문 이름은 자음으로 끝나면 받침으로 간주(폴백). */
export function hasBatchim(word: string): boolean {
  const ch = word.trimEnd().slice(-1); const code = ch.codePointAt(0) ?? 0
  if (HANGUL(code)) return (code - 0xac00) % 28 !== 0
  if (/[a-z]/i.test(ch)) return !/[aeiouy]/i.test(ch)
  if (/[0-9]/.test(ch)) return '013678'.includes(ch)
  return false
}
function endsWithRieul(word: string): boolean {
  const code = word.trimEnd().slice(-1).codePointAt(0) ?? 0
  return HANGUL(code) && (code - 0xac00) % 28 === 8
}
export function josa(word: string, particle: string): string {
  const pair = PAIRS[particle]; if (!pair) return word + particle
  if (pair[0] === '으로') return word + (hasBatchim(word) && !endsWithRieul(word) ? '으로' : '로')
  return word + (hasBatchim(word) ? pair[0] : pair[1])
}
/** "{hotspot:을}" / "{char}" 치환 */
export function applyTemplate(tpl: string, names: { hotspot?: string; char?: string }): string {
  return tpl.replace(/\{(hotspot|char)(?::([^}]+))?\}/g, (_m, k: 'hotspot' | 'char', p?: string) => {
    const n = names[k] ?? ''
    return p ? josa(n, p) : n
  })
}
