import { describe, it, expect } from 'vitest'
import { diffSaves, bytesToBase64, base64ToBytes } from '../src/save/cloudSync'

describe('diffSaves', () => {
  const local = { 'lure.001': { mtime: 1000_000, size: 300 }, 'lure.002': { mtime: 2000_000, size: 400 } }
  it('uploads local-only and newer-local files', () => {
    const d = diffSaves(local, [{ slot: 'lure.001', mtime: 500_000, size: 300 }])
    expect(d.upload.sort()).toEqual(['lure.001', 'lure.002']); expect(d.download).toEqual([]); expect(d.conflict).toEqual([])
  })
  it('downloads cloud-only files silently', () => {
    const d = diffSaves({}, [{ slot: 'lure.003', mtime: 1, size: 10 }])
    expect(d.download).toEqual(['lure.003']); expect(d.upload).toEqual([]); expect(d.conflict).toEqual([])
  })
  it('newer cloud version of an existing local file is a conflict (ask the user)', () => {
    const d = diffSaves(local, [{ slot: 'lure.001', mtime: 9_000_000, size: 333 }])
    expect(d.conflict).toEqual(['lure.001'])
  })
  it('same mtime within 5s tolerance and same size → nothing', () => {
    const d = diffSaves(local, [{ slot: 'lure.001', mtime: 1000_000 + 3000, size: 300 }, { slot: 'lure.002', mtime: 2000_000, size: 400 }])
    expect(d).toEqual({ upload: [], download: [], conflict: [] })
  })
})
describe('base64 round trip', () => {
  it('encodes and decodes binary', () => {
    const src = new Uint8Array(70000).map((_, i) => (i * 7) & 255)
    expect(base64ToBytes(bytesToBase64(src))).toEqual(src)
  })
})
