import { CURVE_ORDER, type Scalar } from "@starkms/crypto";

/**
 * ChaCha20-based random number generator for deterministic testing
 * Compatible with Rust's ChaCha20Rng implementation
 */
export class ChaCha20Rng {
  private state: Uint32Array;
  private buffer: Uint8Array;
  private bufferPos: number;

  constructor(seed: Uint8Array) {
    if (seed.length !== 32) {
      throw new Error("ChaCha20Rng requires a 32-byte seed");
    }

    // Initialize ChaCha20 state
    this.state = new Uint32Array(16);
    this.buffer = new Uint8Array(64);
    this.bufferPos = 64; // Force initial generation

    // ChaCha20 constants
    this.state[0] = 0x61707865;
    this.state[1] = 0x3320646e;
    this.state[2] = 0x79622d32;
    this.state[3] = 0x6b206574;

    // Key (32 bytes = 8 words)
    for (let i = 0; i < 8; i++) {
      this.state[4 + i] = 
        (seed[i * 4 + 0]! << 0) |
        (seed[i * 4 + 1]! << 8) |
        (seed[i * 4 + 2]! << 16) |
        (seed[i * 4 + 3]! << 24);
    }

    // Counter (8 bytes = 2 words)
    this.state[12] = 0;
    this.state[13] = 0;

    // Nonce (8 bytes = 2 words)
    this.state[14] = 0;
    this.state[15] = 0;
  }

  /**
   * Generate the next 64 bytes using ChaCha20 core
   */
  private generateBlock(): void {
    const working = new Uint32Array(this.state);

    // 20 rounds (10 double rounds)
    for (let i = 0; i < 10; i++) {
      // Column rounds
      this.quarterRound(working, 0, 4, 8, 12);
      this.quarterRound(working, 1, 5, 9, 13);
      this.quarterRound(working, 2, 6, 10, 14);
      this.quarterRound(working, 3, 7, 11, 15);

      // Diagonal rounds
      this.quarterRound(working, 0, 5, 10, 15);
      this.quarterRound(working, 1, 6, 11, 12);
      this.quarterRound(working, 2, 7, 8, 13);
      this.quarterRound(working, 3, 4, 9, 14);
    }

    // Add original state
    for (let i = 0; i < 16; i++) {
      working[i] = (working[i]! + this.state[i]!) >>> 0;
    }

    // Convert to bytes
    for (let i = 0; i < 16; i++) {
      const word = working[i]!;
      this.buffer[i * 4 + 0] = (word >>> 0) & 0xff;
      this.buffer[i * 4 + 1] = (word >>> 8) & 0xff;
      this.buffer[i * 4 + 2] = (word >>> 16) & 0xff;
      this.buffer[i * 4 + 3] = (word >>> 24) & 0xff;
    }

    // Increment counter
    this.state[12] = (this.state[12]! + 1) >>> 0;
    if (this.state[12] === 0) {
      this.state[13] = (this.state[13]! + 1) >>> 0;
    }

    this.bufferPos = 0;
  }

  /**
   * ChaCha20 quarter round function
   */
  private quarterRound(state: Uint32Array, a: number, b: number, c: number, d: number): void {
    state[a] = (state[a]! + state[b]!) >>> 0;
    state[d]! ^= state[a]!;
    state[d] = ((state[d]! << 16) | (state[d]! >>> 16)) >>> 0;

    state[c] = (state[c]! + state[d]!) >>> 0;
    state[b]! ^= state[c]!;
    state[b] = ((state[b]! << 12) | (state[b]! >>> 20)) >>> 0;

    state[a] = (state[a]! + state[b]!) >>> 0;
    state[d]! ^= state[a]!;
    state[d] = ((state[d]! << 8) | (state[d]! >>> 24)) >>> 0;

    state[c] = (state[c]! + state[d]!) >>> 0;
    state[b]! ^= state[c]!;
    state[b] = ((state[b]! << 7) | (state[b]! >>> 25)) >>> 0;
  }

  /**
   * Generate random bytes
   */
  nextBytes(length: number): Uint8Array {
    const result = new Uint8Array(length);
    let pos = 0;

    while (pos < length) {
      if (this.bufferPos >= 64) {
        this.generateBlock();
      }

      const available = Math.min(64 - this.bufferPos, length - pos);
      result.set(this.buffer.subarray(this.bufferPos, this.bufferPos + available), pos);
      this.bufferPos += available;
      pos += available;
    }

    return result;
  }

  /**
   * Generate a random scalar in the valid range [1, CURVE_ORDER-1]
   */
  nextScalar(): Scalar {
    let scalar: Scalar;
    do {
      const bytes = this.nextBytes(32);
      scalar = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
      scalar = scalar % CURVE_ORDER;
    } while (scalar === 0n);
    return scalar;
  }

  /**
   * Generate a random u32
   */
  nextU32(): number {
    const bytes = this.nextBytes(4);
    return (bytes[0]! << 0) | (bytes[1]! << 8) | (bytes[2]! << 16) | (bytes[3]! << 24);
  }
}

/**
 * Create a ChaCha20Rng from the same seed used in Rust test vector
 */
export function createChaCha20Rng(): ChaCha20Rng {
  // Use the same seed as Rust: [42u8; 32]
  const seed = new Uint8Array(32).fill(42);
  return new ChaCha20Rng(seed);
} 