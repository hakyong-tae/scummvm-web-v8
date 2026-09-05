import type { LureTextRecord } from '../engine/types'

export const GAME_W = 320
export const GAME_H = 200

export interface CssBox { left: number; top: number; width: number; height: number; fontPx: number }

/** 게임 좌표(320×200) → 캔버스 박스 기준 CSS px. 폰트 크기는 글자 높이(8px)의 스케일. */
export function toCss(r: LureTextRecord, canvasBox: { width: number; height: number }): CssBox {
  const sx = canvasBox.width / GAME_W
  const sy = canvasBox.height / GAME_H
  return { left: r.x * sx, top: r.y * sy, width: r.w * sx, height: r.h * sy, fontPx: r.h * sy }
}
