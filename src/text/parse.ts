import type { LureTextRecord } from '../engine/types'

const isRgb = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every(n => Number.isInteger(n) && n >= 0 && n <= 255)

function isRecord(v: unknown): v is LureTextRecord {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return Number.isInteger(r.x) && Number.isInteger(r.y) &&
    Number.isInteger(r.w) && (r.w as number) > 0 &&
    Number.isInteger(r.h) && (r.h as number) > 0 &&
    typeof r.t === 'string' && r.t.length > 0 &&
    isRgb(r.c) && isRgb(r.b)
}

/** 엔진 JSON → 유효 레코드만. 실패해도 절대 throw 하지 않는다. */
export function parseRecords(json: string): LureTextRecord[] {
  let v: unknown
  try { v = JSON.parse(json) } catch { return [] }
  if (!Array.isArray(v)) return []
  return v.filter(isRecord)
}
