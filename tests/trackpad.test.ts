import { describe, it, expect } from 'vitest'
import { TrackpadFSM } from '../src/input/trackpad'

describe('TrackpadFSM (trackpad mode)', () => {
  it('tap → left click', () => {
    const f = new TrackpadFSM({ mode: 'trackpad' })
    expect(f.down(100, 100, 0)).toEqual([])
    expect(f.up(120)).toEqual([{ type: 'click', button: 0 }])
  })
  it('drag → relative moves, no click', () => {
    const f = new TrackpadFSM({ mode: 'trackpad' })
    f.down(100, 100, 0)
    expect(f.move(110, 104, 50)).toEqual([{ type: 'move', dx: 10, dy: 4 }])
    expect(f.move(115, 104, 80)).toEqual([{ type: 'move', dx: 5, dy: 0 }])
    expect(f.up(120)).toEqual([])
  })
  it('long press → right down, drag selects, release → right up', () => {
    const f = new TrackpadFSM({ mode: 'trackpad' })
    f.down(100, 100, 0)
    expect(f.tick(450)).toEqual([{ type: 'rdown' }])
    expect(f.move(100, 130, 600)).toEqual([{ type: 'move', dx: 0, dy: 30 }])
    expect(f.up(700)).toEqual([{ type: 'rup' }])
  })
  it('a slow tap (300ms, shorter than long-press) is still a click', () => {
    const f = new TrackpadFSM({ mode: 'trackpad' })
    f.down(50, 50, 0); expect(f.tick(300)).toEqual([])
    expect(f.up(300)).toEqual([{ type: 'click', button: 0 }])
  })
  it('small jitter within 8px still counts as tap', () => {
    const f = new TrackpadFSM({ mode: 'trackpad' })
    f.down(100, 100, 0); f.move(103, 102, 60)
    expect(f.up(150)).toEqual([{ type: 'click', button: 0 }])
  })
  it('tick after release does nothing', () => {
    const f = new TrackpadFSM({ mode: 'trackpad' })
    f.down(0, 0, 0); f.up(100)
    expect(f.tick(1000)).toEqual([])
  })
})
describe('TrackpadFSM (direct mode)', () => {
  it('down warps cursor, up clicks', () => {
    const f = new TrackpadFSM({ mode: 'direct' })
    expect(f.down(40, 50, 0)).toEqual([{ type: 'warp', x: 40, y: 50 }])
    expect(f.up(100)).toEqual([{ type: 'click', button: 0 }])
  })
  it('long press in direct mode also opens the verb menu', () => {
    const f = new TrackpadFSM({ mode: 'direct' })
    f.down(40, 50, 0)
    expect(f.tick(500)).toEqual([{ type: 'rdown' }])
    expect(f.up(600)).toEqual([{ type: 'rup' }])
  })
})
