/**
 * PoseidonAccumulator.test.ts
 *
 * Extended tests for PoseidonMerkleAccumulator covering:
 * - Proof length consistency
 * - Determinism and idempotency of proof generation
 * - Cross-accumulator determinism (with same updates)
 * - Default leaf (empty) proofs
 * - Tampered proof rejections (both sibling hash and pathBits modifications)
 * - Invalidation of an old proof after unrelated updates
 * - Repeated updates on the same leaf
 * - Handling of large BigInt values (e.g. 256-bit values)
 * - Rejection on mismatched proof parameters
 * - Bulk updates and tree consistency checking
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
    const root = accumulator.getRoot()
    expect(typeof root).toBe("bigint")
    expect(root).not.toBe(0n)
    // Check internal consistency of the tree.
    expect(accumulator.validateTree()).toBe(true)
  })

  it("throws error when updating leaf with out-of-range index", () => {
    expect(() => accumulator.updateLeaf(-1, 42n)).toThrow()
    expect(() => accumulator.updateLeaf(accumulator.size, 42n)).toThrow()
  })

  it("updates a leaf and changes the root deterministically", () => {
    const oldRoot = accumulator.getRoot()
    const newLeaf = 1234567890123456789n
    accumulator.updateLeaf(3, newLeaf)
    const newRoot = accumulator.getRoot()
    expect(newRoot).not.toBe(oldRoot)
    expect(accumulator.validateTree()).toBe(true)
  })

  it("generates valid membership proofs", () => {
    const leafIndex = 5
    const leafValue = 99999999999n
    accumulator.updateLeaf(leafIndex, leafValue)
    const root = accumulator.getRoot()
    const { siblings, pathBits } = accumulator.getProof(leafIndex)
    const isValid = PoseidonMerkleAccumulator.verifyProof(
      leafValue,
      leafIndex,
      root,
      siblings,
      pathBits,
    )
    expect(isValid).toBe(true)
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
    const leaves = [10n, 20n, 30n, 40n]
    leaves.forEach((val, idx) => {
      accumulator.updateLeaf(idx, val)
    })
    const root = accumulator.getRoot()
    expect(typeof root).toBe("bigint")
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
    expect(() => accumulator.getProof(0)).not.toThrow()
    expect(() => accumulator.getProof(15)).not.toThrow()
    expect(() => accumulator.getProof(-1)).toThrow()
    expect(() => accumulator.getProof(16)).toThrow()
  })

  // ===== Additional Extended Tests =====

  it("generates proofs of fixed length equal to tree depth", () => {
    for (let i = 0; i < accumulator["size"]; i++) {
      const proof = accumulator.getProof(i)
      expect(proof.siblings.length).toBe(DEPTH)
      expect(proof.pathBits.length).toBe(DEPTH)
    }
  })

  it("is deterministic across accumulators with same updates", () => {
    const accumulator2 = new PoseidonMerkleAccumulator(DEPTH)
    const updates = [
      { index: 0, value: 111n },
      { index: 3, value: 222n },
      { index: 7, value: 333n },
      { index: 15, value: 444n },
    ]
    for (const upd of updates) {
      accumulator.updateLeaf(upd.index, upd.value)
      accumulator2.updateLeaf(upd.index, upd.value)
    }
    expect(accumulator.getRoot()).toBe(accumulator2.getRoot())
  })

  it("verifies proof for a default (empty) leaf", () => {
    const leafIndex = 8
    const defaultProof = accumulator.getProof(leafIndex)
    expect(
      PoseidonMerkleAccumulator.verifyProof(
        0n,
        leafIndex,
        accumulator.getRoot(),
        defaultProof.siblings,
        defaultProof.pathBits,
      ),
    ).toBe(true)
  })

  it("rejects tampered proof with modified sibling hash", () => {
    const leafIndex = 2
    const leafValue = 555n
    accumulator.updateLeaf(leafIndex, leafValue)
    const proof = accumulator.getProof(leafIndex)
    proof.siblings[0] = proof.siblings[0] + 1n
    expect(
      PoseidonMerkleAccumulator.verifyProof(
        leafValue,
        leafIndex,
        accumulator.getRoot(),
        proof.siblings,
        proof.pathBits,
      ),
    ).toBe(false)
  })

  it("rejects tampered proof with modified pathBits", () => {
    const leafIndex = 4
    const leafValue = 666n
    accumulator.updateLeaf(leafIndex, leafValue)
    const proof = accumulator.getProof(leafIndex)
    proof.pathBits[0] = proof.pathBits[0] === 0 ? 1 : 0
    expect(
      PoseidonMerkleAccumulator.verifyProof(
        leafValue,
        leafIndex,
        accumulator.getRoot(),
        proof.siblings,
        proof.pathBits,
      ),
    ).toBe(false)
  })

  it("invalidates old proofs after unrelated tree updates", () => {
    const leafIndex = 6
    const leafValue = 777n
    accumulator.updateLeaf(leafIndex, leafValue)
    const oldProof = accumulator.getProof(leafIndex)
    const oldRoot = accumulator.getRoot()
    accumulator.updateLeaf(0, 888n)
    const newRoot = accumulator.getRoot()
    expect(
      PoseidonMerkleAccumulator.verifyProof(
        leafValue,
        leafIndex,
        oldRoot,
        oldProof.siblings,
        oldProof.pathBits,
      ),
    ).toBe(true)
    expect(
      PoseidonMerkleAccumulator.verifyProof(
        leafValue,
        leafIndex,
        newRoot,
        oldProof.siblings,
        oldProof.pathBits,
      ),
    ).toBe(false)
  })

  it("handles repeated updates on the same leaf", () => {
    const leafIndex = 10
    const value1 = 100n
    accumulator.updateLeaf(leafIndex, value1)
    const rootAfterFirst = accumulator.getRoot()
    const proof1 = accumulator.getProof(leafIndex)
    expect(
      PoseidonMerkleAccumulator.verifyProof(
        value1,
        leafIndex,
        rootAfterFirst,
        proof1.siblings,
        proof1.pathBits,
      ),
    ).toBe(true)
    const value2 = 200n
    accumulator.updateLeaf(leafIndex, value2)
    const rootAfterSecond = accumulator.getRoot()
    const proof2 = accumulator.getProof(leafIndex)
    expect(
      PoseidonMerkleAccumulator.verifyProof(
        value2,
        leafIndex,
        rootAfterSecond,
        proof2.siblings,
        proof2.pathBits,
      ),
    ).toBe(true)
    accumulator.updateLeaf(leafIndex, value1)
    const rootAfterThird = accumulator.getRoot()
    const proof3 = accumulator.getProof(leafIndex)
    expect(
      PoseidonMerkleAccumulator.verifyProof(
        value1,
        leafIndex,
        rootAfterThird,
        proof3.siblings,
        proof3.pathBits,
      ),
    ).toBe(true)
  })

  it("handles large BigInt values", () => {
    const leafIndex = 12
    const largeValue = (2n ** 256n) - 1n
    accumulator.updateLeaf(leafIndex, largeValue)
    const root = accumulator.getRoot()
    const proof = accumulator.getProof(leafIndex)
    expect(
      PoseidonMerkleAccumulator.verifyProof(
        largeValue,
        leafIndex,
        root,
        proof.siblings,
        proof.pathBits,
      ),
    ).toBe(true)
    expect(root).not.toBe(0n)
  })

  it("throws error when verifying proof with mismatched siblings and pathBits lengths", () => {
    const leafIndex = 3
    const leafValue = 123n
    accumulator.updateLeaf(leafIndex, leafValue)
    const proof = accumulator.getProof(leafIndex)
    const mismatchedSiblings = proof.siblings.slice(1)
    expect(() =>
      PoseidonMerkleAccumulator.verifyProof(
        leafValue,
        leafIndex,
        accumulator.getRoot(),
        mismatchedSiblings,
        proof.pathBits,
      ),
    ).toThrow()
  })

  it("updates all leaves and verifies their proofs", () => {
    const values: bigint[] = []
    for (let i = 0; i < accumulator["size"]; i++) {
      const value = BigInt(i + 1)
      values.push(value)
      accumulator.updateLeaf(i, value)
    }
    const root = accumulator.getRoot()
    for (let i = 0; i < accumulator["size"]; i++) {
      const proof = accumulator.getProof(i)
      expect(
        PoseidonMerkleAccumulator.verifyProof(
          values[i],
          i,
          root,
          proof.siblings,
          proof.pathBits,
        ),
      ).toBe(true)
    }
  })

  // ===== New Tests for Bulk Updates and Internal Consistency =====

  it("handles bulk updates and verifies proofs", () => {
    const bulkUpdates = [
      { index: 0, value: 111n },
      { index: 3, value: 222n },
      { index: 7, value: 333n },
      { index: 15, value: 444n },
    ]
    accumulator.updateLeaves(bulkUpdates)
    const root = accumulator.getRoot()
    bulkUpdates.forEach((upd) => {
      const proof = accumulator.getProof(upd.index)
      expect(
        PoseidonMerkleAccumulator.verifyProof(
          upd.value,
          upd.index,
          root,
          proof.siblings,
          proof.pathBits,
        ),
      ).toBe(true)
    })
    // The tree should be internally consistent after bulk update.
    expect(accumulator.validateTree()).toBe(true)
  })

  it("throws error on bulk update with out-of-range index", () => {
    const badUpdates = [
      { index: 0, value: 123n },
      { index: -1, value: 456n },
    ]
    expect(() => accumulator.updateLeaves(badUpdates)).toThrow()
  })

  it("detects internal state corruption via validateTree", () => {
    accumulator.updateLeaf(5, 999n)
    // validateTree should return true normally.
    expect(accumulator.validateTree()).toBe(true);

    // Simulate corruption: directly modify an internal node.
    (accumulator as any).tree[2] = 123456789n
    expect(accumulator.validateTree()).toBe(false)
  })

  it("getProof returns consistent output on repeated calls", () => {
    const leafIndex = 7
    accumulator.updateLeaf(leafIndex, 777n)
    const proof1 = accumulator.getProof(leafIndex)
    const proof2 = accumulator.getProof(leafIndex)
    expect(proof1.siblings).toEqual(proof2.siblings)
    expect(proof1.pathBits).toEqual(proof2.pathBits)
  })
})
