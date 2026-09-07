/** 엔진이 화면 좌표(320x200)로 보고하는 텍스트 한 조각 */
export interface LureTextRecord {
  x: number; y: number; w: number; h: number
  t: string                      // 표시 문자열(UTF-8)
  c: [number, number, number]    // 글자색 RGB
  b: [number, number, number]    // 배경색 RGB (그리기 직전 (x,y) 픽셀)
}

export interface EngineCallbacks {
  onFrameText?(records: LureTextRecord[]): void
  onString?(table: number, local: number, text: string, hotspot: string, char: string): void
  onStatus?(text: string): void
  onReady?(): void
  onQuit?(code: number): void
}

export interface BootOptions {
  canvas: HTMLCanvasElement
  engineBase: string          // 예: new URL('engine/', document.baseURI).href
  args: string[]              // 예: ['lure']
  callbacks: EngineCallbacks
}
