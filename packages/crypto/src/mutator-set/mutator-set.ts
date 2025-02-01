/**
 * Demonstrates how the AOCL and SWBF fit together in a minimal, working example.
 * We omit actual zero-knowledge proofs; the user of this class would do them off-chain
 * or in a separate process.
 */

import {
  AppendOnlyCommitmentList,
  commitItem,
} from "./append-only-commitment-list"
import {
  SlidingWindowBloomFilter,
  bloomPositions,
} from "./sliding-window-bloom-filter"

/**
 * MutatorSet
 *
 * Ties together:
 * 1) An append-only list of commitments (AOCL).
 * 2) A sliding-window Bloom filter (SWBF) for removals.
 *
 * This class demonstrates the conceptual flow described in the doc,
 * omitting zero-knowledge proofs. Instead, we rely on direct knowledge
 * of item + randomness to remove from the set.
 */
export class MutatorSet {
  private aocl: AppendOnlyCommitmentList
  private swbf: SlidingWindowBloomFilter

  /**
   * @param aoclDepth Depth for the AOCL’s underlying Merkle structure
   * @param bloomSize Number of bits in the SWBF "active window"
   * @param bloomArchiveDepth Depth for archiving old bloom windows
   */
  constructor(aoclDepth: number, bloomSize: number, bloomArchiveDepth: number) {
    this.aocl = new AppendOnlyCommitmentList(aoclDepth)
    this.swbf = new SlidingWindowBloomFilter(bloomSize, bloomArchiveDepth)
  }

  /**
   * Add an item to the mutator set.
   * 1) Generate random nonce r (for demonstration we just do a random bigint)
   * 2) c = commit(item, r)
   * 3) Append c to AOCL => get index
   * 4) Return (index, c, r) so that the user can prove membership or remove later.
   *
   * @example
   * ```ts
   * const ms = new MutatorSet(10, 64, 5);
   * const { index, commitment, randomness } = ms.addItem(12345n);
   * console.log("Added item, AOCL index:", index);
   * ```
   */
  public addItem(item: bigint): {
    index: number
    commitment: bigint
    randomness: bigint
  } {
    // For demonstration, generate some random nonce
    // You might want cryptographically secure random here:
    const randomness = BigInt(Math.floor(Math.random() * 1_000_000_000))

    // Commit(t, r)
    const c = commitItem(item, randomness)

    // Append to AOCL
    const index = this.aocl.append(c)

    return { index, commitment: c, randomness }
  }

  /**
   * Remove an item from the set (conceptually).
   * The user must know:
   * 1) item
   * 2) index in AOCL
   * 3) randomness used in the original commitment
   * We then compute the Bloom filter positions and flip them to 1.
   *
   * @example
   * ```ts
   * ms.removeItem(12345n, index, randomness);
   * ```
   */
  public removeItem(item: bigint, indexInAOCL: number, randomness: bigint) {
    // 1) re-check commitment (not a ZK approach—just for demonstration)
    const c = commitItem(item, randomness)

    // 2) Optionally, confirm the AOCL has c at the given index:
    const root = this.aocl.getRoot()
    const { siblings, pathBits } = this.aocl.getProof(indexInAOCL)
    const verified = AppendOnlyCommitmentList.verify(
      c,
      indexInAOCL,
      root,
      siblings,
      pathBits,
    )
    if (!verified) {
      throw new Error("Invalid AOCL membership proof for removal. ")
    }

    // 3) Compute Bloom positions
    const filterSize = this.swbf.getActiveWindowBits().length
    const positions = bloomPositions(item, indexInAOCL, randomness, filterSize)

    // 4) Flip those bits
    this.swbf.flipBits(positions)
  }

  /**
   * Slide the bloom filter’s active window.
   * This archives the old window bits to a separate Poseidon-based structure
   * and resets the active window to all zeros.
   *
   * @example
   * ```ts
   * ms.slideBloomWindow();
   * ```
   */
  public slideBloomWindow() {
    this.swbf.slideWindow()
  }

  /**
   * @returns the AOCL root, the archived bloom root, and the current active window bits.
   */
  public getStateSnapshot() {
    return {
      aoclRoot: this.aocl.getRoot(),
      bloomArchiveRoot: this.swbf.getArchiveRoot(),
      activeWindowBits: this.swbf.getActiveWindowBits(),
    }
  }

  /**
   * For demonstration: a naive check that a bit is set in the active window (NOT a zero-knowledge approach).
   * In real usage, you'd still do ZK proofs to detect double-removes or read the bits.
   */
  public isBitSet(bitPos: number): boolean {
    const bits = this.swbf.getActiveWindowBits()
    return bits[bitPos] === 1
  }
}
