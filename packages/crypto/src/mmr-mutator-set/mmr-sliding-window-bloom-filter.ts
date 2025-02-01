/**
 * mmr-sliding-window-bloom-filter.ts
 *
 * A sliding-window bloom filter that archives old windows into an MMR for compact storage.
 */

import { poseidonHash } from "micro-starknet"
import { Mmr } from "./mmr"

/**
 * Simplified function to compute bloom positions:
 * For demonstration, we do poseidonHash(item, nonce) mod windowSize, etc.
 */
export function bloomPositionsMmr(
  item: bigint,
  indexInAOCL: number,
  randomness: bigint,
  filterSize: number,
  numBitsToFlip = 2,
): number[] {
  // For each seed in [0..(numBitsToFlip-1)], we compute:
  //   pos_i = PoseidonHash(item, randomness, indexInAOCL+seed) mod filterSize
  const positions: number[] = []
  for (let seed = 0; seed < numBitsToFlip; seed++) {
    const h = poseidonHash(
      poseidonHash(item, randomness),
      BigInt(indexInAOCL + seed),
    )
    positions.push(Number(h % BigInt(filterSize)))
  }
  return positions
}

/**
 * MmrSlidingWindowBloomFilter
 *
 * We maintain:
 * 1) An active array of bits (size=windowSize).
 * 2) A simple MMR for archived windows (once we slide).
 */
export class MmrSlidingWindowBloomFilter {
  private activeWindow: Uint8Array
  private mmr: Mmr // archive older windows
  private windowSize: number

  constructor(windowSize: number) {
    this.activeWindow = new Uint8Array(windowSize)
    this.windowSize = windowSize
    this.mmr = new Mmr()
  }

  /**
   * Flip bits in the active window (from 0 to 1).
   */
  public flipBits(positions: number[]) {
    for (const pos of positions) {
      if (pos < 0 || pos >= this.windowSize) {
        throw new Error(`Flip bit out of range: ${pos}`)
      }
      this.activeWindow[pos] = 1
    }
  }

  /**
   * Slide the active window:
   * - Convert it to a single BigInt or hash
   * - Append to MMR
   * - Reset the active window
   */
  public slideWindow() {
    const bitsAsBigint = this.packBits(this.activeWindow)
    this.mmr.append(bitsAsBigint)
    this.activeWindow.fill(0)
  }

  /**
   * Return the MMR root of archived windows.
   */
  public getArchiveRoot(): bigint {
    return this.mmr.getRoot()
  }

  /**
   * Return a copy of the active window bits.
   */
  public getActiveWindowBits(): Uint8Array {
    return new Uint8Array(this.activeWindow)
  }

  /**
   * Utility: pack bits from a Uint8Array (each 0/1) into a single BigInt.
   */
  private packBits(bits: Uint8Array): bigint {
    let out = 0n
    for (let i = 0; i < bits.length; i++) {
      out = (out << 1n) + BigInt(bits[i])
    }
    return out
  }
}
