import { describe, it, expect } from 'vitest'
import { nextChoiceIndex } from '../src/input/keys'

describe('nextChoiceIndex', () => {
  it('starts at the first item on ArrowDown, last on ArrowUp', () => {
    expect(nextChoiceIndex(-1, 1, 3)).toBe(0)
    expect(nextChoiceIndex(-1, -1, 3)).toBe(2)
  })
  it('moves and clamps at both ends', () => {
    expect(nextChoiceIndex(0, 1, 3)).toBe(1)
    expect(nextChoiceIndex(2, 1, 3)).toBe(2)
    expect(nextChoiceIndex(0, -1, 3)).toBe(0)
  })
  it('returns -1 when there is nothing to pick', () => { expect(nextChoiceIndex(0, 1, 0)).toBe(-1) })
})
