import type { LureTextRecord } from '../engine/types'

export const recordKey = (r: LureTextRecord) => `${r.x},${r.y},${r.t}`

export interface RecordDiff { added: LureTextRecord[]; removed: LureTextRecord[]; kept: LureTextRecord[] }

export function diffRecords(prev: LureTextRecord[], next: LureTextRecord[]): RecordDiff {
  const prevMap = new Map(prev.map(r => [recordKey(r), r]))
  const nextKeys = new Set(next.map(recordKey))
  const added: LureTextRecord[] = [], kept: LureTextRecord[] = []
  for (const r of next) (prevMap.has(recordKey(r)) ? kept : added).push(r)
  const removed = prev.filter(r => !nextKeys.has(recordKey(r)))
  return { added, removed, kept }
}
