import type { BootOptions } from './types'
import { parseRecords } from '../text/parse'

declare global { interface Window { Module: Record<string, unknown> } }

/** 전역 Module을 구성한 뒤 scummvm.js를 주입한다. 콜백 예외는 전부 삼켜서 엔진을 죽이지 않는다. */
export function bootEngine(opts: BootOptions): Promise<void> {
  const { canvas, engineBase, args, callbacks } = opts
  const base = engineBase.replace(/\/$/, '')

  const safe = <A extends unknown[]>(fn?: (...a: A) => void) => (...a: A) => {
    try { fn?.(...a) } catch (e) { console.error('[lure-callback]', e) }
  }

  return new Promise((resolve) => {
    window.Module = {
      canvas,
      arguments: [...args],
      enableWebMIDI: false,
      httpFsBaseUrl: base,                                 // 패치 03: "/data/…" → `${base}/data/…`
      locateFile: (path: string) => `${base}/${path}`,     // scummvm.wasm 위치
      print: (t: string) => console.log(t),
      printErr: (t: string) => console.warn(t),
      setStatus: safe((t: string) => callbacks.onStatus?.(t)),
      onRuntimeInitialized: safe(() => { callbacks.onReady?.(); resolve() }),
      onLureText: safe((json: string) => callbacks.onFrameText?.(parseRecords(json))),
      onLureString: safe((table: number, local: number, text: string, hotspot: string, char: string) => callbacks.onString?.(table, local, text, hotspot, char)),
      onLureQuit: safe((code: number) => callbacks.onQuit?.(code)),
    }
    const s = document.createElement('script')
    s.src = `${base}/scummvm.js`
    s.async = true
    s.onerror = () => callbacks.onStatus?.('엔진 스크립트를 불러오지 못했습니다')
    document.body.appendChild(s)
  })
}
