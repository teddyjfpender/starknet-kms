import { CURVE_ORDER, type Scalar, moduloOrder } from "@starkms/crypto";

/**
 * Seeded random number generator for deterministic testing
 * Uses a simple LCG (Linear Congruential Generator) for reproducible results
 */
export class SeededRNG {
  private state: bigint;

  constructor(seed: Uint8Array) {
    // Convert seed bytes to a bigint state
    this.state = BigInt('0x' + Array.from(seed).map(b => b.toString(16).padStart(2, '0')).join(''));
    // Ensure state is in valid range
    this.state = this.state % CURVE_ORDER;
    if (this.state === 0n) {
      this.state = 1n;
    }
  }

  /**
   * Generate next random bigint using LCG
   * Using parameters: a = 1664525, c = 1013904223 (common LCG parameters)
   */
  next(): bigint {
    const a = 1664525n;
    const c = 1013904223n;
    this.state = (a * this.state + c) % CURVE_ORDER;
    return this.state;
  }

  /**
   * Generate a random scalar in the valid range [1, CURVE_ORDER-1]
   */
  randScalar(): Scalar {
    let k: Scalar;
    do {
      k = this.next();
    } while (k === 0n);
    return k;
  }

  /**
   * Generate random bytes of specified length
   */
  randBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 8) {
      const randomBigInt = this.next();
      const randomBytes = new Uint8Array(8);
      for (let j = 0; j < 8 && i + j < length; j++) {
        randomBytes[j] = Number((randomBigInt >> BigInt(j * 8)) & 0xFFn);
      }
      bytes.set(randomBytes.slice(0, Math.min(8, length - i)), i);
    }
    return bytes;
  }
}

/**
 * Create a seeded RNG from the same seed used in Rust test vector
 */
export function createSeededRNG(): SeededRNG {
  // Use the same seed as Rust: [42u8; 32]
  const seed = new Uint8Array(32).fill(42);
  return new SeededRNG(seed);
}

/**
 * Seeded version of randScalar for deterministic testing
 */
export function seededRandScalar(rng: SeededRNG): Scalar {
  return rng.randScalar();
} 