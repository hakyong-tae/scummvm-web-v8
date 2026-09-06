import type { LocalSnap } from './cloudSync'

/** Emscripten 전역 FS의 필요한 부분만. 비-MODULARIZE 빌드라 window.FS로 노출된다. */
export interface EmFS {
  readdir(path: string): string[]
  readFile(path: string): Uint8Array
  writeFile(path: string, data: Uint8Array): void
  stat(path: string): { mtime: Date; size: number }
  mkdir(path: string): void
  analyzePath(path: string): { exists: boolean }
  syncfs(populate: boolean, cb: (err?: unknown) => void): void
}
declare global { interface Window { FS?: EmFS } }

export const getFS = (): EmFS | null => (typeof window !== 'undefined' && window.FS) ? window.FS : null

export function ensureDir(fs: EmFS, dir: string) {
  if (!fs.analyzePath(dir).exists) fs.mkdir(dir)
}
/** 세이브 디렉터리의 파일 → {mtime(ms), size}. 디렉터리가 없으면 {} */
export function snapshot(fs: EmFS, dir: string): LocalSnap {
  if (!fs.analyzePath(dir).exists) return {}
  const out: LocalSnap = {}
  for (const f of fs.readdir(dir)) {
    if (f === '.' || f === '..') continue
    const st = fs.stat(`${dir}/${f}`)
    out[f] = { mtime: st.mtime.getTime(), size: st.size }
  }
  return out
}
export const readSave = (fs: EmFS, dir: string, slot: string) => fs.readFile(`${dir}/${slot}`)
export function writeSave(fs: EmFS, dir: string, slot: string, data: Uint8Array): Promise<void> {
  ensureDir(fs, dir); fs.writeFile(`${dir}/${slot}`, data)
  return new Promise(res => fs.syncfs(false, () => res()))
}
