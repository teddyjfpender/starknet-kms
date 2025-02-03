/**
 * A simple fixed-depth Merkle Accumulator using Poseidon as the internal hash.
 */

import { poseidonHash } from "micro-starknet"

// Helper: Poseidon hash for two BigInt inputs (already provided by micro-starknet).
// export function poseidonHash(a: bigint, b: bigint): bigint { ... } // available from the library

/**
 * A class that represents a Poseidon-based Merkle accumulator.
 * - Fixed-depth binary tree
 * - Each leaf is a BigInt
 * - Root is Poseidon hash of children up to the top
 */
export class PoseidonMerkleAccumulator {
  public readonly depth: number
  public readonly size: number // Number of leaves = 2^depth
  private tree: bigint[] // Store all nodes in array form
  private zeroHashes: bigint[] // zeroHashes[i] = empty-node-hash at level i

  /**
   * @param depth Number of levels for the Merkle tree (leaf-only levels).
   */
  constructor(depth: number) {
    this.depth = depth
    this.size = 1 << depth // 2^depth leaves

    // For an index-based tree:
    // - The root is at index 1.
    // - Leaves start at index 1 << depth (2^depth).
    // - The total size of the array is 2^(depth+1) (i.e. 2 * size).
    // We'll use a 1-based index for convenience.
    this.tree = new Array<bigint>(2 * this.size).fill(0n)

    // Precompute zero-hashes for each level
    this.zeroHashes = this.buildZeroHashes()
    this.initTreeWithZeros()
  }

  /**
   * Builds an array of zero-hashes for each level:
   * zeroHashes[0] = hash of an empty leaf
   * zeroHashes[1] = hash of two empty leaves
   * ...
   * zeroHashes[depth] = root hash if the entire tree is empty
   */
  private buildZeroHashes(): bigint[] {
    const zeroHashes: bigint[] = new Array(this.depth + 1).fill(0n)

    // zeroHashes[0] = "empty leaf" (we'll choose 0n as the leaf)
    zeroHashes[0] = 0n

    // For level i, zeroHashes[i] = PoseidonHash( zeroHashes[i-1], zeroHashes[i-1] )
    for (let i = 1; i <= this.depth; i++) {
      zeroHashes[i] = poseidonHash(zeroHashes[i - 1], zeroHashes[i - 1])
    }
    return zeroHashes
  }

  /**
   * Initialize all leaves to 0n, then build the internal nodes accordingly.
   */
  private initTreeWithZeros() {
    // 1. Fill leaves [size..(2*size-1)] with zeroHashes[0]
    for (let i = this.size; i < 2 * this.size; i++) {
      this.tree[i] = this.zeroHashes[0]
    }

    // 2. Build the tree upward
    for (let i = this.size - 1; i >= 1; i--) {
      this.tree[i] = poseidonHash(this.tree[i << 1], this.tree[(i << 1) + 1])
    }
  }

  /**
   * Insert a leaf value at a given leaf index (0-based).
   * Then re-hash the path to the root.
   * @param leafIndex The 0-based index of the leaf
   * @param leafValue The BigInt value of the new leaf
   */
  public updateLeaf(leafIndex: number, leafValue: bigint) {
    if (leafIndex < 0 || leafIndex >= this.size) {
      throw new Error(
        `Leaf index ${leafIndex} out of range (0..${this.size - 1})`,
      )
    }
    // 1. Update leaf node in the array
    let treeIndex = leafIndex + this.size // array index for that leaf
    this.tree[treeIndex] = leafValue

    // 2. Re-hash up to the root
    treeIndex >>= 1 // move to parent
    while (treeIndex >= 1) {
      const left = this.tree[treeIndex << 1]
      const right = this.tree[(treeIndex << 1) + 1]
      this.tree[treeIndex] = poseidonHash(left, right)
      treeIndex >>= 1
    }
  }

  /**
   * Bulk update: update multiple leaves, then rebuild the entire tree in one pass.
   * @param updates Array of updates with leaf index and new value.
   */
  public updateLeaves(updates: { index: number; value: bigint }[]): void {
    // Validate and update leaves in one go.
    for (const upd of updates) {
      if (upd.index < 0 || upd.index >= this.size) {
        throw new Error(
          `Leaf index ${upd.index} out of range (0..${this.size - 1})`,
        )
      }
      this.tree[upd.index + this.size] = upd.value
    }
    // Rebuild the tree from the leaves upward in one pass.
    for (let i = this.size - 1; i >= 1; i--) {
      this.tree[i] = poseidonHash(this.tree[i << 1], this.tree[(i << 1) + 1])
    }
  }

  /**
   * Validate that every internal node of the tree is consistent with its children.
   * @returns true if the tree is valid; false otherwise.
   */
  public validateTree(): boolean {
    // Check internal nodes: for each node i (1 <= i < this.size),
    // recompute the hash from its two children and compare.
    for (let i = 1; i < this.size; i++) {
      const left = this.tree[i << 1]
      const right = this.tree[(i << 1) + 1]
      const expected = poseidonHash(left, right)
      if (this.tree[i] !== expected) {
        return false
      }
    }
    return true
  }

  /**
   * @returns The current Merkle root (BigInt).
   */
  public getRoot(): bigint {
    return this.tree[1]
  }

  /**
   * Generate a Merkle proof for a leaf index.
   * @param leafIndex 0-based leaf index
   * @returns {
   *   siblings: bigint[],  // array of sibling node hashes from leaf to root
   *   pathBits: number[]   // 0/1 bits indicating whether sibling is left(0) or right(1)
   * }
   */
  public getProof(leafIndex: number): {
    siblings: bigint[]
    pathBits: number[]
  } {
    if (leafIndex < 0 || leafIndex >= this.size) {
      throw new Error(`Leaf index ${leafIndex} out of range`)
    }

    const siblings: bigint[] = []
    const pathBits: number[] = []
    let idx = leafIndex + this.size

    // Move up the tree, collecting siblings
    while (idx > 1) {
      const isRightNode = (idx & 1) === 1
      const siblingIndex = isRightNode ? idx - 1 : idx + 1
      siblings.push(this.tree[siblingIndex])
      pathBits.push(isRightNode ? 1 : 0)
      idx >>= 1 // move to parent
    }
    return { siblings, pathBits }
  }

  /**
   * Verifies a Merkle proof for a given leaf value & root.
   * @param leafValue The claimed leaf's value
   * @param leafIndex 0-based index of the leaf
   * @param root The known Merkle root
   * @param siblings The array of sibling hashes
   * @param pathBits Array of 0/1 bits indicating left(0) or right(1)
   * @returns true if the proof is valid; false otherwise
   */
  public static verifyProof(
    leafValue: bigint,
    leafIndex: number,
    root: bigint,
    siblings: bigint[],
    pathBits: number[],
  ): boolean {
    if (siblings.length !== pathBits.length) {
      throw new Error("siblings.length != pathBits.length")
    }
    let hash = leafValue

    for (let i = 0; i < siblings.length; i++) {
      const siblingHash = siblings[i]
      const bit = pathBits[i]
      if (bit === 1) {
        // This means current node was "right", so the sibling is the left node
        hash = poseidonHash(siblingHash, hash)
      } else {
        // This means current node was "left", so the sibling is the right node
        hash = poseidonHash(hash, siblingHash)
      }
    }

    return hash === root
  }
}
