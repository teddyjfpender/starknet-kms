/**
 * MmrMutatorSet.ts
 *
 * A demonstration of using MMR for the Append-Only Commitment List (AOCL) and
 * a sliding-window Bloom filter that also archives old windows in an MMR.
 *
 * We do not implement ZK proofs here—just the data structure logic.
 */

import {
  MmrAppendOnlyCommitmentList,
  commitItemMmr,
} from "./mmr-append-only-commitment-list"
import {
  MmrSlidingWindowBloomFilter,
  bloomPositionsMmr,
} from "./mmr-sliding-window-bloom-filter"

/**
 * MmrMutatorSet
 *
 * The "mutator set" that satisfies:
 * 1) AOCL for item additions (commitments).
 * 2) A sliding-window bloom filter for item removals.
 */
export class MmrMutatorSet {
  private aocl: MmrAppendOnlyCommitmentList
  private swbf: MmrSlidingWindowBloomFilter

  constructor(windowSize: number) {
    // no need for "depth" as in previous examples, since MMR extends dynamically
    this.aocl = new MmrAppendOnlyCommitmentList()
    this.swbf = new MmrSlidingWindowBloomFilter(windowSize)
  }

  /**
   * Add an item by committing to (t, r).
   * Then append to the AOCL MMR.
   */
  public addItem(item: bigint): {
    index: number
    commitment: bigint
    randomness: bigint
  } {
    // for demonstration, pick a random nonce
    const randomness = BigInt(Math.floor(Math.random() * 1_000_000_000))
    const commitment = commitItemMmr(item, randomness)

    const index = this.aocl.append(commitment)
    return { index, commitment, randomness }
  }

  /**
   * Remove an item (conceptually).
   * We require knowledge of (item, index, randomness).
   * Then we flip the bloom bits for that item.
   * We do a membership check to confirm the item is in the AOCL.
   */
  public removeItem(item: bigint, indexInAOCL: number, randomness: bigint) {
    // Recompute the commitment
    const c = commitItemMmr(item, randomness)

    // membership check
    const root = this.aocl.getRoot()
    const proof = this.aocl.getProof(indexInAOCL)
    const verified = MmrAppendOnlyCommitmentList.verify(
      c,
      indexInAOCL,
      root,
      proof,
    )
    if (!verified) {
      throw new Error("Invalid membership proof; item not in AOCL MMR.")
    }

    // Flip bloom bits
    const filterSize = this.swbf.getActiveWindowBits().length
    const positions = bloomPositionsMmr(
      item,
      indexInAOCL,
      randomness,
      filterSize,
    )
    this.swbf.flipBits(positions)
  }

  /**
   * Slide the bloom filter window, archiving old bits into the MMR.
   */
  public slideWindow() {
    this.swbf.slideWindow()
  }

  /**
   * Return a snapshot of the mutator set's "accumulator" state:
   * - MMR root of AOCL
   * - MMR root of old bloom windows
   * - Active window bits
   */
  public getStateSnapshot() {
    return {
      aoclRoot: this.aocl.getRoot(),
      bloomArchiveRoot: this.swbf.getArchiveRoot(),
      activeWindowBits: this.swbf.getActiveWindowBits(),
    }
  }
}
