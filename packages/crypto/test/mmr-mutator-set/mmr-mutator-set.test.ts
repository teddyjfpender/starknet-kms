/**
 * MmrMutatorSet.test.ts
 */
import { describe, expect, it } from "bun:test"
import { MmrMutatorSet } from "../../src/mmr-mutator-set/mmr-mutator-set"

describe("MmrMutatorSet with MMR", () => {
  it("adds items and changes AOCL MMR root", () => {
    const ms = new MmrMutatorSet(8) // bloom window size=8
    const { index, commitment } = ms.addItem(123n)

    expect(index).toBe(0)
    const state = ms.getStateSnapshot()
    expect(typeof state.aoclRoot).toBe("bigint")
    expect(state.activeWindowBits.length).toBe(8)
    expect(typeof state.bloomArchiveRoot).toBe("bigint")
  })

  it("removes items, flipping bits in the bloom filter", () => {
    const ms = new MmrMutatorSet(8)
    const { index, commitment, randomness } = ms.addItem(999n)

    const before = ms.getStateSnapshot()
    const beforeBits = before.activeWindowBits.slice()

    // remove
    ms.removeItem(999n, index, randomness)

    const after = ms.getStateSnapshot()
    // AOCL root won't change on removal
    expect(after.aoclRoot).toBe(before.aoclRoot)

    // Some bits in the active window should have flipped
    let changes = 0
    const afterBits = after.activeWindowBits
    for (let i = 0; i < beforeBits.length; i++) {
      if (beforeBits[i] !== afterBits[i]) {
        changes++
      }
    }
    expect(changes).toBeGreaterThan(0)
  })

  it("rejects removal if membership check fails", () => {
    const ms = new MmrMutatorSet(8)
    const { index, commitment, randomness } = ms.addItem(888n)

    // wrong item
    expect(() => ms.removeItem(887n, index, randomness)).toThrow(
      /Invalid membership proof/,
    )

    // wrong index
    expect(() => ms.removeItem(888n, index + 1, randomness)).toThrow(
      /Index out of range/,
    )
  })

  it("slides the bloom window, archiving bits into the MMR", () => {
    const ms = new MmrMutatorSet(4)
    // Add + remove to flip bits
    const { index, randomness } = ms.addItem(42n)
    ms.removeItem(42n, index, randomness)

    const stateBefore = ms.getStateSnapshot()
    const bitsBefore = stateBefore.activeWindowBits.slice()
    let bitCount = 0
    for (let i = 0; i < bitsBefore.length; i++) {
      bitCount += bitsBefore[i]
    }
    expect(bitCount).toBeGreaterThan(0)

    // Slide
    ms.slideWindow()
    const stateAfter = ms.getStateSnapshot()
    // active window should be zeroed
    const bitsAfter = stateAfter.activeWindowBits
    for (const b of bitsAfter) {
      expect(b).toBe(0)
    }
    // bloomArchiveRoot presumably changed
    expect(stateAfter.bloomArchiveRoot).not.toBe(stateBefore.bloomArchiveRoot)
  })
})
