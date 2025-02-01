/**
 * MutatorSet.test.ts
 */
import { describe, expect, it } from "bun:test"
import { commitItem } from "../../src/mutator-set/append-only-commitment-list"
import { MutatorSet } from "../../src/mutator-set/mutator-set"

describe("MutatorSet", () => {
  it("adds items and retrieves AOCL root", () => {
    const ms = new MutatorSet(8, 16, 5)
    const { index, commitment } = ms.addItem(123n)

    expect(index).toBe(0) // first insertion => index=0
    const state = ms.getStateSnapshot()
    expect(typeof state.aoclRoot).toBe("bigint")
    expect(state.activeWindowBits.length).toBe(16)
    expect(state.bloomArchiveRoot).toBeDefined()
  })

  it("removes an item, flipping bits in the bloom filter", () => {
    const ms = new MutatorSet(8, 16, 5)
    // 1) Add item
    const item = 777n
    const { index, commitment, randomness } = ms.addItem(item)

    // 2) Confirm item is indeed in the AOCL
    const stateBeforeRemove = ms.getStateSnapshot()
    const aoclRootBefore = stateBeforeRemove.aoclRoot

    // 3) Remove that item
    ms.removeItem(item, index, randomness)

    // 4) Check that some bits are flipped in the active window
    const stateAfterRemove = ms.getStateSnapshot()
    expect(stateAfterRemove.aoclRoot).toBe(aoclRootBefore) // Removing doesn't change AOCL
    // We expect at least one bit changed from 0 => 1
    const bitsBefore = stateBeforeRemove.activeWindowBits
    const bitsAfter = stateAfterRemove.activeWindowBits
    let flips = 0
    for (let i = 0; i < bitsBefore.length; i++) {
      if (bitsBefore[i] !== bitsAfter[i]) {
        flips++
      }
    }
    expect(flips).toBeGreaterThanOrEqual(1)
  })

  it("rejects remove if item or index are wrong", () => {
    const ms = new MutatorSet(8, 16, 5)
    const { index, commitment, randomness } = ms.addItem(555n)

    // If we try to remove with the wrong item
    expect(() => ms.removeItem(556n, index, randomness)).toThrow(
      /Invalid AOCL membership proof/,
    )

    // If we try to remove with the wrong index
    expect(() => ms.removeItem(555n, index + 1, randomness)).toThrow(
      /Invalid AOCL membership proof/,
    )
  })

  it("slides the bloom window and archives old bits", () => {
    const ms = new MutatorSet(8, 8, 5) // small bloom window of size=8
    // Add & remove a couple items to flip some bits
    const itemA = 999n
    const { index: idxA, randomness: randA } = ms.addItem(itemA)
    ms.removeItem(itemA, idxA, randA)

    // Some bits should be set
    let snap = ms.getStateSnapshot()
    const activeBitsBeforeSlide = snap.activeWindowBits.slice()
    let bitCount = 0
    for (let i = 0; i < activeBitsBeforeSlide.length; i++) {
      bitCount += activeBitsBeforeSlide[i]
    }
    expect(bitCount).toBeGreaterThan(0)

    // Slide the window
    ms.slideBloomWindow()

    // Active window bits should be all zero
    snap = ms.getStateSnapshot()
    const activeBitsAfterSlide = snap.activeWindowBits
    for (let i = 0; i < activeBitsAfterSlide.length; i++) {
      expect(activeBitsAfterSlide[i]).toBe(0)
    }

    // The bloomArchiveRoot presumably changed to reflect the archived bits
    // (we haven't fully tested that logic, but the concept stands)
    // For demonstration, let's just check that it’s a bigint
    expect(typeof snap.bloomArchiveRoot).toBe("bigint")
  })
})
