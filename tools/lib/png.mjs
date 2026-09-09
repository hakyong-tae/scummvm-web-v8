// 최소 PNG 디코더 — Chrome 스크린샷(8bit RGBA/RGB, non-interlaced)만 다룬다.
// 캔버스 픽셀을 JS로 읽으면 WebGL 드로잉 버퍼가 프레임 밖에서 비어 있어 항상 검게 나온다.
// 그래서 검증은 실제 스크린샷 바이트를 디코드해서 한다.
import { inflateSync } from 'node:zlib'

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png')
  let off = 8, w = 0, h = 0, depth = 0, color = 0, interlace = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4)
      depth = data[8]; color = data[9]; interlace = data[12]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    off += 12 + len
  }
  if (depth !== 8 || interlace !== 0 || (color !== 6 && color !== 2)) {
    throw new Error(`unsupported png: depth=${depth} color=${color} interlace=${interlace}`)
  }
  const bpp = color === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[p++]
    const line = raw.subarray(p, p + stride); p += stride
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[x] = v & 0xff
    }
  }
  return { w, h, bpp, data: out }
}

/** 고유색 수·비검정 비율 — 검은 화면/단색 판정용 */
export function imageStats(png) {
  const { w, h, bpp, data } = png
  const seen = new Set(); let nonblack = 0, n = 0
  for (let i = 0; i < data.length; i += bpp) {
    const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    if (k) nonblack++
    if (seen.size < 4096) seen.add(k)
    n++
  }
  return { w, h, colors: seen.size, nonblackPct: +(100 * nonblack / n).toFixed(1) }
}
