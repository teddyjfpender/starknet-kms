/**
 * PoseidonAccumulator.test.ts
 */
import { beforeEach, describe, expect, it } from "bun:test"
import { poseidonHash } from "micro-starknet" // for direct hash checks if needed
import { PoseidonMerkleAccumulator } from "../../src/accumulator/poseidon-accumulator"

describe("PoseidonMerkleAccumulator", () => {
  const DEPTH = 4 // For test: a small tree of 16 leaves
  let accumulator: PoseidonMerkleAccumulator

  beforeEach(() => {
    accumulator = new PoseidonMerkleAccumulator(DEPTH)
  })

  it("initializes with correct root for empty tree", () => {
    // The root after initialization should match the zero-hash at depth
    const root = accumulator.getRoot()
    expect(typeof root).toBe("bigint")
    // For an empty tree, the root is the "zeroHashes[depth]" internally
    // There's no direct "expected" number here without computing it,
    // but we can simply check it's not 0 (Poseidon(0,0) up to 4 levels).
    expect(root).not.toBe(0n)
  })

  it("updates a leaf and changes the root deterministically", () => {
    const oldRoot = accumulator.getRoot()
    const newLeaf = 1234567890123456789n
    accumulator.updateLeaf(3, newLeaf)
    const newRoot = accumulator.getRoot()
    expect(newRoot).not.toBe(oldRoot)
  })

  it("generates valid membership proofs", () => {
    const leafIndex = 5
    const leafValue = 99999999999n
    // 1) Update leaf
    accumulator.updateLeaf(leafIndex, leafValue)

    // 2) Get updated root
    const root = accumulator.getRoot()

    // 3) Get proof
    const { siblings, pathBits } = accumulator.getProof(leafIndex)

    // 4) Verify
    const isValid = PoseidonMerkleAccumulator.verifyProof(
      leafValue,
      leafIndex,
      root,
      siblings,
      pathBits,
    )
    expect(isValid).toBe(true)

    // If we change the leaf value, the proof should fail
    const isValidFake = PoseidonMerkleAccumulator.verifyProof(
      leafValue + 1n,
      leafIndex,
      root,
      siblings,
      pathBits,
    )
    expect(isValidFake).toBe(false)
  })

  it("handles multiple leaf updates and proofs", () => {
    // Insert 4 distinct leaves
    const leaves = [10n, 20n, 30n, 40n]
    leaves.forEach((val, idx) => {
      accumulator.updateLeaf(idx, val)
    })
    const root = accumulator.getRoot()
    expect(typeof root).toBe("bigint")

    // Check membership proofs for each
    leaves.forEach((val, idx) => {
      const { siblings, pathBits } = accumulator.getProof(idx)
      const isValid = PoseidonMerkleAccumulator.verifyProof(
        val,
        idx,
        root,
        siblings,
        pathBits,
      )
      expect(isValid).toBe(true)
    })
  })

  it("rejects proof if leafIndex is out of range", () => {
    // Positive test: leafIndex within range
    expect(() => accumulator.getProof(0)).not.toThrow()
    expect(() => accumulator.getProof(15)).not.toThrow()

    // Negative test: leafIndex out of range
    expect(() => accumulator.getProof(-1)).toThrow()
    expect(() => accumulator.getProof(16)).toThrow()
  })
})
