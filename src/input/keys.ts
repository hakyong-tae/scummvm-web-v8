/** 게임 캔버스에 합성 키 입력. SDL3 Emscripten은 canvas에 디스패치한 KeyboardEvent를 받는다(실측). */
const CODES: Record<string, { code: string; keyCode: number }> = {
  Escape: { code: 'Escape', keyCode: 27 }, Enter: { code: 'Enter', keyCode: 13 }, Backspace: { code: 'Backspace', keyCode: 8 }, ' ': { code: 'Space', keyCode: 32 },
}
export function pressKey(canvas: HTMLElement, key: string) {
  const known = CODES[key]
  const code = known?.code ?? (/^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/.test(key) ? `Digit${key}` : key)
  const keyCode = known?.keyCode ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0)
  for (const type of ['keydown', 'keyup'] as const)
    canvas.dispatchEvent(new KeyboardEvent(type, { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true }))
}
/** 문자열을 한 글자씩 입력(ASCII만 — 엔진 세이브 이름 입력은 라틴 글자 전용). */
export async function typeText(canvas: HTMLElement, text: string, gapMs = 40) {
  for (const ch of text.replace(/[^\x20-\x7e]/g, '')) { pressKey(canvas, ch); await new Promise(r => setTimeout(r, gapMs)) }
}
