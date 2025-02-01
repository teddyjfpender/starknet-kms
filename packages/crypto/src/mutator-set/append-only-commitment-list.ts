import { poseidonHash } from "micro-starknet"
import { PoseidonMerkleAccumulator } from "../accumulator/poseidon-accumulator"

/**
 * AppendOnlyCommitmentList
 *
 * Stores a list of commitments (bigint) in an immutable, append-only manner.
 * Under the hood, we maintain a Poseidon-based Merkle tree, re-built on each append.
 *
 * In a real system, you'd use a Merkle Mountain Range (MMR) or a more optimized
 * approach. This is a demonstration of the conceptual flow using your existing code.
 */
export class AppendOnlyCommitmentList {
  private accumulator: PoseidonMerkleAccumulator
  private currentIndex: number // Number of appended items so far

  /**
   * Constructor
   * @param depth  The depth of the underlying PoseidonMerkleAccumulator (fixed-size).
   *               If you want to store up to N items, you need depth >= log2(N).
   */
  constructor(depth: number) {
    this.accumulator = new PoseidonMerkleAccumulator(depth)
    this.currentIndex = 0
  }

  /**
   * Appends a new commitment to the list.
   * @param commitment The commitment (bigint) to store in the AOCL.
   * @returns index at which the commitment was placed
   *
   * @example
   * ```ts
   * const aocl = new AppendOnlyCommitmentList(10);
   * const index = aocl.append(123n);
   * console.log("Committed at index: ", index);
   * ```
   */
  public append(commitment: bigint): number {
    if (this.currentIndex >= this.accumulator.size) {
      throw new Error("AOCL is full. Increase depth or create a new AOCL.")
    }
    this.accumulator.updateLeaf(this.currentIndex, commitment)
    const appendedIndex = this.currentIndex
    this.currentIndex += 1
    return appendedIndex
  }

  /**
   * @returns the Merkle root (BigInt) that commits to all appended commitments.
   */
  public getRoot(): bigint {
    return this.accumulator.getRoot()
  }

  /**
   * @returns the total number of items currently appended
   */
  public getLength(): number {
    return this.currentIndex
  }

  /**
   * Retrieves a proof that the item at `index` is indeed in the list.
   * This is effectively a Merkle proof in the underlying PoseidonAccumulator.
   */
  public getProof(index: number): {
    siblings: bigint[]
    pathBits: number[]
  } {
    return this.accumulator.getProof(index)
  }

  /**
   * Verifies that a commitment is stored at the given index with respect
   * to a known root. This is a standard Merkle membership check.
   * @param commitment The commitment that should be at `index`.
   * @param index The index at which that commitment was appended.
   * @param root The known AOCL root
   * @param siblings sibling path from getProof
   * @param pathBits left(0)/right(1) bits from getProof
   */
  public static verify(
    commitment: bigint,
    index: number,
    root: bigint,
    siblings: bigint[],
    pathBits: number[],
  ): boolean {
    return PoseidonMerkleAccumulator.verifyProof(
      commitment,
      index,
      root,
      siblings,
      pathBits,
    )
  }
}

/**
 * Simple commitment function for demonstration in a Mutator Set:
 * commit(t, r) = PoseidonHash(t, r).
 *
 * In real usage, you'd choose a more flexible scheme (like H(t||r) with domain separation).
 */
export function commitItem(item: bigint, randomNonce: bigint): bigint {
  return poseidonHash(item, randomNonce)
}
