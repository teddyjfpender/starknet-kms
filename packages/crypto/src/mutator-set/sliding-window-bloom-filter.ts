/**
 * Demonstrates a sliding-window bloom filter for the mutator set.
 * We'll store bits in an array `activeWindow`.
 * Periodically, we "slide" older bits out into an "archive" Merkle structure
 * so we don't keep an ever-growing array.
 */

import { poseidonHash } from "micro-starknet"
import { PoseidonMerkleAccumulator } from "../accumulator/poseidon-accumulator"

/**
 * Returns k distinct positions (bit indices) for an item in the Bloom filter,
 * computed via Poseidon hashing. The doc suggests something like:
 *   positions = H(t, l, r, seed) mod filterSize
 * for seed = 0..(k-1).
 *
 * For demonstration, we do a simple approach with k=2 or k=3 (e.g. `numberOfBitsToFlip` = 2). This should be extend as needed.
 */
export function bloomPositions(
  item: bigint,
  indexInAOCL: number,
  randomness: bigint,
  filterSize: number,
  numberOfBitsToFlip = 2,
): number[] {
  // For each "seed" from 0..(k-1):
  // position_i = PoseidonHash(item, randomness, BigInt(indexInAOCL), BigInt(seed)) mod filterSize
  const positions: number[] = []
  for (let seed = 0; seed < numberOfBitsToFlip; seed++) {
    const hashVal = poseidonHash(
      poseidonHash(item, randomness),
      BigInt(indexInAOCL + seed),
    )
    const pos = Number(hashVal % BigInt(filterSize))
    positions.push(pos)
  }
  return positions
}

/**
 * SlidingWindowBloomFilter
 * - Maintains an active window: a fixed-size array of bits.
 * - Maintains an archival Merkle structure for older bits.
 */
export class SlidingWindowBloomFilter {
  private activeWindow: Uint8Array // Each element is 0 or 1
  private accumulator: PoseidonMerkleAccumulator // Archive for older windows
  private windowSize: number

  /**
   * @param windowSize The size of the active Bloom filter window (# of bits).
   * @param depth Depth for the archival Poseidon tree if you want to store old windows.
   */
  constructor(windowSize: number, depth: number) {
    this.windowSize = windowSize
    this.activeWindow = new Uint8Array(windowSize)
    this.accumulator = new PoseidonMerkleAccumulator(depth)
  }

  /**
   * Flip the bits in the active window for a removal.
   * @param positions array of bit positions to set to 1
   *
   * @example
   * ```ts
   * swbf.flipBits([10, 25]); // sets activeWindow[10] = 1, activeWindow[25] = 1
   * ```
   */
  public flipBits(positions: number[]): void {
    for (const pos of positions) {
      if (pos < 0 || pos >= this.windowSize) {
        throw new Error(`Bit position out of range: ${pos}`)
      }
      this.activeWindow[pos] = 1 // set bit to 1
    }
  }

  /**
   * "Slide" the active window out to the archive, clearing the active window.
   * For demonstration, we:
   * 1. Convert the entire activeWindow into a single bigint (Poseidon-based).
   * 2. Append it to the archive accumulator.
   * 3. Reset the activeWindow to all zeros.
   *
   * In production, you'd do more granular archiving, e.g. "sliding" partial windows.
   */
  public slideWindow(): void {
    // 1. Convert bits to a commitment
    const bitsAsBigint = this.bitsToBigint(this.activeWindow)
    this.accumulator.updateLeaf(0, bitsAsBigint) // we do "leaf=0" for simplicity
    // or you might want to append to the next empty leaf in a bigger tree
    // 2. Reset the activeWindow
    this.activeWindow.fill(0)
  }

  /**
   * @returns the root of the archived windows
   */
  public getArchiveRoot(): bigint {
    return this.accumulator.getRoot()
  }

  /**
   * @returns an immutable snapshot of the active window bits
   */
  public getActiveWindowBits(): Uint8Array {
    return new Uint8Array(this.activeWindow)
  }

  /**
   * Utility: pack bits from a Uint8Array (each element 0/1) into a single bigint
   * using Poseidon or something simpler. Here, we just do:
   *   combined = poseidon( chunk_1, chunk_2, ... )
   * for demonstration. For a large window, you'd likely chunk them or use an
   * efficient packing method.
   */
  private bitsToBigint(bits: Uint8Array): bigint {
    // Convert small groups of bits into BigInt, then combine with a rolling hash
    let result = 0n
    for (let i = 0; i < bits.length; i++) {
      // Shift left & add new bit
      result = (result << 1n) + BigInt(bits[i])
    }
    // Could do an optional Poseidon mix if you like:
    // return poseidonHash(result, 123n);
    return result
  }
}
