import { SAVE_DIR, SAVE_POLL_MS, SAVE_MAX_BYTES } from '../config'
import { callServer, hasPlatform } from '../verse8/gameserver'
import { getFS, snapshot, readSave, writeSave, type EmFS } from './fsSaves'
import { diffSaves, bytesToBase64, base64ToBytes, type CloudEntry, type LocalSnap } from './cloudSync'

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'error'
export interface SyncUI { setStatus(s: SyncStatus, detail?: string): void; confirmRestore(slots: string[]): Promise<boolean> }

/** 부팅 후 복원 → 5초 폴링 업로드. 플랫폼 밖이면 offline 배지만. */
export class SaveSyncController {
  private last: LocalSnap = {}
  private timer: ReturnType<typeof setInterval> | null = null
  private busy = false
  constructor(private ui: SyncUI) {}

  async start() {
    if (!hasPlatform()) { this.ui.setStatus('offline', '로컬 저장만 (Verse8 밖)'); return }
    const fs = getFS(); if (!fs) { this.ui.setStatus('error', 'FS 없음'); return }
    this.ui.setStatus('syncing', '클라우드 확인 중')
    const cloud = await callServer<CloudEntry[] | null>('listSaves', [], null)
    if (cloud === null) { this.ui.setStatus('offline', '서버 연결 실패'); this.beginPolling(fs); return }
    const local = snapshot(fs, SAVE_DIR)
    const d = diffSaves(local, cloud)
    for (const slot of d.download) await this.download(fs, slot)
    if (d.conflict.length && await this.ui.confirmRestore(d.conflict)) for (const slot of d.conflict) await this.download(fs, slot)
    for (const slot of d.upload) await this.upload(fs, slot)
    this.last = snapshot(fs, SAVE_DIR)
    this.ui.setStatus('idle', '동기화됨')
    this.beginPolling(fs)
  }

  private beginPolling(fs: EmFS) {
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => void this.poll(fs), SAVE_POLL_MS)
    addEventListener('pagehide', () => void this.poll(fs))
  }

  private async poll(fs: EmFS) {
    if (this.busy) return
    const now = snapshot(fs, SAVE_DIR)
    const changed = Object.keys(now).filter(k => !this.last[k] || this.last[k].mtime !== now[k].mtime || this.last[k].size !== now[k].size)
    this.last = now
    if (!changed.length) return
    this.busy = true
    try { for (const slot of changed) await this.upload(fs, slot) }
    finally { this.busy = false }
  }

  private async upload(fs: EmFS, slot: string) {
    const bytes = readSave(fs, SAVE_DIR, slot)
    if (bytes.length > SAVE_MAX_BYTES) { console.warn('[save] too large, skip', slot); return }
    this.ui.setStatus('syncing', `업로드: ${slot}`)
    const mtime = fs.stat(`${SAVE_DIR}/${slot}`).mtime.getTime()
    const ok = await callServer<{ updated: boolean } | null>('putSave', [slot, slot, mtime, bytesToBase64(bytes)], null)
    this.ui.setStatus(ok ? 'idle' : 'error', ok ? '동기화됨' : '업로드 실패')
  }

  private async download(fs: EmFS, slot: string) {
    const item = await callServer<{ data: string; mtime: number } | null>('getSave', [slot], null)
    if (!item?.data) return
    await writeSave(fs, SAVE_DIR, slot, base64ToBytes(item.data))
  }
}
