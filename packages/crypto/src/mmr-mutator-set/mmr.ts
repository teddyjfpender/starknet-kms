/**
 * mmr.ts
 *
 * A minimal example of a Merkle Mountain Range (MMR) using Poseidon for internal node hashing.
 * MMR usage: we store an ordered list of leaves. Each append extends the MMR with a known structure.
 */

import { poseidonHash } from "micro-starknet"

/**
 * MmrNode
 * - Contains a hash value for this node
 * - We keep track of leaf or internal node, for clarity
 */
interface MmrNode {
  hash: bigint
  isLeaf: boolean
}

/**
 * MmrProofItem
 * - A node hash plus a "position hint" (left/right or a relevant direction).
 *   For simplicity, we just store the hash, and rely on the known MMR structure
 *   to figure out how to combine it.
 */
export interface MmrProofItem {
  hash: bigint
}

/**
 * Mmr
 *
 * 1) We hold a dynamic list of leaves.
 * 2) After each append, we "fold" them up into parent nodes according to standard MMR logic:
 *    - Pair up consecutive trees of the same height.
 *    - Combine them with PoseidonHash to form a parent, continuing until no further pairing is possible.
 * 3) We store the top-most nodes as "peaks".
 *
 * For membership proofs:
 * - We walk from the leaf up to the relevant peak, collecting sibling hashes.
 * - In a real MMR, we'd store more nuanced data (leaf index, etc.). This is a simplified demonstration.
 */
export class Mmr {
  private leaves: MmrNode[] = []
  // The peaks represent the top of each perfect subtree
  private peaks: MmrNode[] = []

  constructor() {
    // Start with an empty MMR
    this.leaves = []
    this.peaks = []
  }

  /**
   * Append a new leaf. Return its index (0-based).
   * Then re-calculate the MMR peaks.
   */
  public append(leafValue: bigint): number {
    const leafNode: MmrNode = { hash: leafValue, isLeaf: true }
    const leafIndex = this.leaves.length
    this.leaves.push(leafNode)

    // Re-build the peaks from the new leaf "bubbling up"
    this.rebuildPeaks()

    return leafIndex
  }

  /**
   * Return the single MMR "root" by hashing all peaks together in a right-to-left manner.
   * (You can define different orders. We'll pick a simple approach: fold peaks from left to right.)
   */
  public getRoot(): bigint {
    if (this.peaks.length === 0) return 0n
    let current = this.peaks[0].hash
    for (let i = 1; i < this.peaks.length; i++) {
      current = poseidonHash(current, this.peaks[i].hash)
    }
    return current
  }

  /**
   * Provide a membership proof for the leaf at `index`.
   * We'll gather the sibling node hashes on the path from leaf to peak.
   *
   * NOTE: This is a simplified approach. Real MMR proofs typically store
   * extra info (positions, heights). But this will suffice to illustrate the concept.
   */
  public getProof(index: number): MmrProofItem[] {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`Index out of range: ${index}`)
    }
    // We'll climb up from the leaf to the peaks, pairing with siblings at each step.
    // For demonstration, we do a naive approach: re-run the "rebuild" logic but track
    // which node merges with which. In production, you'd store merges in an index-based structure.
    const path: MmrProofItem[] = []
    const leafNode = this.leaves[index]

    // Start from the leaf, build internal nodes on the fly.
    // We'll store ephemeral state and replay the "folding" but track siblings.
    const localLeaves = this.leaves.map((x) => ({ ...x })) // shallow clone
    let nodeIndex = index

    function foldOnce(nodes: MmrNode[]): MmrNode[] {
      const nextLevel: MmrNode[] = []
      let i = 0
      while (i < nodes.length) {
        if (i + 1 < nodes.length) {
          // Try pairing
          const left = nodes[i]
          const right = nodes[i + 1]
          if (left.isLeaf === right.isLeaf) {
            // They are subtrees of the same height, merge them
            const parentHash = poseidonHash(left.hash, right.hash)
            const parentNode: MmrNode = { hash: parentHash, isLeaf: false }

            // If our nodeIndex matches left or right, we add the other node to the proof
            // because that node is the "sibling" in the climb
            if (
              nodes === localLeaves &&
              (i === nodeIndex || i + 1 === nodeIndex)
            ) {
              const siblingHash = i === nodeIndex ? right.hash : left.hash
              path.push({ hash: siblingHash })
              // We also know we've moved to the parent, so the parent's index in nextLevel is nextLevel.length
              nodeIndex = nextLevel.length
            }

            nextLevel.push(parentNode)
            i += 2
          } else {
            // Different heights, skip merging
            nextLevel.push(left)
            i += 1
          }
        } else {
          // no pair for the last node
          nextLevel.push(nodes[i])
          i += 1
        }
      }
      return nextLevel
    }

    // Rebuild from the bottom up
    let layer = localLeaves
    while (layer.length > 1) {
      const folded = foldOnce(layer)
      if (folded.length === layer.length) {
        // no merges happened => break
        break
      }
      layer = folded
    }

    return path
  }

  /**
   * Verifies that `leafValue` belongs to an MMR with `root`.
   * The proof is a list of sibling hashes encountered while climbing to some peak (or set of peaks).
   */
  public static verify(
    leafValue: bigint,
    proof: MmrProofItem[],
    root: bigint,
  ): boolean {
    // Recompute upward
    let computed = leafValue
    for (const sibling of proof) {
      // We merge them in a consistent left->right manner, say always poseidonHash(computed, sibling)
      computed = poseidonHash(computed, sibling.hash)
    }
    // Now we fold the computed node with the (remaining) peaks if needed. In a minimal approach,
    // let's assume these siblings lead us to a single "peak" that must be in the final root hash chain.
    // We'll just check if `computed` is part of the fold that results in root. Easiest is:
    //  - The final "peak" we computed could be hashed with other peaks to form `root`.
    //  - For simplicity, we just check if computed == root. Real MMR would do more steps if multiple peaks.
    return computed === root
  }

  /**
   * Rebuild the "peaks" from all leaves in a standard MMR manner:
   * - Start from left to right, pair consecutive subtrees if they have the same height.
   * - Form a parent node and continue.
   */
  private rebuildPeaks(): void {
    const allNodes: MmrNode[] = [...this.leaves]
    const peaks: MmrNode[] = []

    while (allNodes.length > 0) {
      let changed = false
      if (allNodes.length >= 2) {
        const left = allNodes[allNodes.length - 2]
        const right = allNodes[allNodes.length - 1]
        // If they are both the same "height" => merge
        // (We approximate "height" by checking isLeaf. In a real MMR, you'd store subtree heights.)
        if (left.isLeaf === right.isLeaf) {
          const merged: MmrNode = {
            hash: poseidonHash(left.hash, right.hash),
            isLeaf: false,
          }
          // remove last two, add merged
          allNodes.splice(allNodes.length - 2, 2)
          allNodes.push(merged)
          changed = true
        }
      }
      if (!changed) {
        // no merge => that last node is a "peak"
        peaks.unshift(allNodes.pop() as MmrNode)
      }
    }
    this.peaks = peaks
  }
}
