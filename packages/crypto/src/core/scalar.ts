import { bytesToHex } from "@noble/hashes/utils"
import { CURVE, utils as starkUtils } from "@scure/starknet"
import { addHexPrefix, assertStringHex } from "./validation"

export type Scalar = bigint

export const CURVE_ORDER = CURVE.n

/* --------------------------- scalar helpers -------------------------------- */

/**
 * Reduces a scalar modulo the curve order, ensuring result is in [0, n)
 */
export const moduloOrder = (x: Scalar): Scalar =>
  ((x % CURVE_ORDER) + CURVE_ORDER) % CURVE_ORDER

/**
 * Generates a random scalar in the range [1, n-1]
 * Never returns 0, which would be invalid for private keys
 */
export function randScalar(): Scalar {
  let k: Scalar
  do {
    k = BigInt(`0x${bytesToHex(starkUtils.randomPrivateKey())}`) % CURVE_ORDER
  } while (k === 0n)
  return k
}

/* --------------------------- conversions ----------------------------------- */

/**
 * Converts a BigInt scalar to hex string with 0x prefix
 */
export const bigIntToHex = (x: Scalar): string => addHexPrefix(x.toString(16))

/**
 * Converts a hex string to BigInt scalar
 * @param h - Hex string (with or without 0x prefix)
 * @returns BigInt scalar
 * @throws InvalidHexError for invalid input
 */
export const hexToBigInt = (h: string): Scalar => {
  // Scalars should be at most 64 hex chars (256 bits)
  const normalizedHex = assertStringHex(h, 64)
  return BigInt(normalizedHex)
}
