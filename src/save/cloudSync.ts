export interface LocalSnap { [slot: string]: { mtime: number; size: number } }
export interface CloudEntry { slot: string; mtime: number; size: number; name?: string }
export interface SaveDiff { upload: string[]; download: string[]; conflict: string[] }
const TOLERANCE_MS = 5000

/** 로컬(IDBFS) vs 클라우드 목록 비교. 클라우드가 더 최신인데 로컬에도 있으면 사용자 확인(conflict). */
export function diffSaves(local: LocalSnap, cloud: CloudEntry[]): SaveDiff {
  const out: SaveDiff = { upload: [], download: [], conflict: [] }
  const cloudMap = new Map(cloud.map(c => [c.slot, c]))
  for (const [slot, l] of Object.entries(local)) {
    const c = cloudMap.get(slot)
    if (!c) { out.upload.push(slot); continue }
    const same = Math.abs(l.mtime - c.mtime) <= TOLERANCE_MS && l.size === c.size
    if (same) continue
    if (l.mtime > c.mtime) out.upload.push(slot)
    else out.conflict.push(slot)
  }
  for (const c of cloud) if (!(c.slot in local)) out.download.push(c.slot)
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64); const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}
