import { describe, it, expect } from 'vitest'
import { parseRecords } from '../src/text/parse'

describe('parseRecords', () => {
  it('accepts well-formed records', () => {
    const json = '[{"x":12,"y":180,"w":40,"h":8,"t":"Look at","c":[255,255,255],"b":[0,0,0]}]'
    expect(parseRecords(json)).toEqual([{ x: 12, y: 180, w: 40, h: 8, t: 'Look at', c: [255, 255, 255], b: [0, 0, 0] }])
  })
  it('drops malformed entries instead of throwing', () => {
    const json = '[{"x":1,"y":2,"w":3,"h":8,"t":"ok","c":[1,2,3],"b":[4,5,6]},{"x":"bad"},null,{"x":0,"y":0,"w":0,"h":8,"t":"","c":[0,0,0],"b":[0,0,0]}]'
    expect(parseRecords(json).map(r => r.t)).toEqual(['ok'])
  })
  it('returns [] on invalid JSON', () => {
    expect(parseRecords('not json')).toEqual([])
  })
})
