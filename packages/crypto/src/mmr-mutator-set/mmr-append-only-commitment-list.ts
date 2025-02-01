/**
 * mmr-append-only-commitment-list.ts
 *
 * Demonstrates using an MMR to store an ordered list of commitments in an append-only manner.
 * Each appended commitment gets a new leaf in the MMR, so the MMR root changes in a well-defined way.
 */

import { poseidonHash } from "micro-starknet"
import { Mmr, type MmrProofItem } from "./mmr"

/**
 * commitItem(t, r) = PoseidonHash(t, r).
 * We keep it simple, as before.
 */
export function commitItemMmr(item: bigint, randomNonce: bigint): bigint {
  return poseidonHash(item, randomNonce)
}

/**
 * MmrAppendOnlyCommitmentList
 *
 * Maintains:
 *  - A running MMR for all appended commitments
 *  - The next index is always the MMR leaf count
 */
export class MmrAppendOnlyCommitmentList {
  private mmr: Mmr
  private currentIndex: number

  constructor() {
    this.mmr = new Mmr()
    this.currentIndex = 0
  }

  /**
   * Append a new commitment to the MMR.
   * Returns the index of that commitment (0-based in insertion order).
   */
  public append(commitment: bigint): number {
    const index = this.mmr.append(commitment)
    // In an MMR with this design, the leaf index is just the count so far.
    this.currentIndex += 1
    return index
  }

  /**
   * Returns the MMR root that commits to the entire list of appended commitments.
   */
  public getRoot(): bigint {
    return this.mmr.getRoot()
  }

  /**
   * Provide a membership proof for the item at `index`.
   */
  public getProof(index: number): MmrProofItem[] {
    return this.mmr.getProof(index)
  }

  /**
   * Verify that `commitment` is in the MMR at `index`, given `root` and the proof.
   */
  public static verify(
    commitment: bigint,
    index: number,
    root: bigint,
    proof: MmrProofItem[],
  ): boolean {
    return Mmr.verify(commitment, proof, root)
  }

  public getLength(): number {
    return this.currentIndex
  }
}
