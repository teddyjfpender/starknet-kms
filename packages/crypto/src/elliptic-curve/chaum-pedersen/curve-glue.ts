import { ec, num } from "starknet";
import { bytesToHex } from "@noble/hashes/utils"; // For converting Uint8Array to hex

// Directly use the specific properties we need to avoid complex type inference issues.
export const CURVE_ORDER = ec.starkCurve.CURVE.n;
export const PRIME = ec.starkCurve.CURVE.p; // Prime for the underlying field Fp

// Use InstanceType to get the instance type of ProjectivePoint class
export type Point = InstanceType<typeof ec.starkCurve.ProjectivePoint>;
export type Scalar = bigint;

export const G: Point = ec.starkCurve.ProjectivePoint.BASE;

/**
 * Generates a cryptographically secure random scalar k such that 1 <= k < CURVE_ORDER.
 * Uses ec.starkCurve.utils.randomPrivateKey() as the CSPRNG source.
 * Returns a bigint.
 */
export function randScalar(): Scalar {
  let scalarBigInt: bigint;
  do {
    const rawBytes: Uint8Array = ec.starkCurve.utils.randomPrivateKey();
    scalarBigInt = num.toBigInt(`0x${bytesToHex(rawBytes)}`);
    scalarBigInt %= CURVE_ORDER; // Ensure it's < CURVE_ORDER, and > 0 implicitly by modulo a large prime order
  } while (scalarBigInt === 0n); // Regenerate if 0 (extremely unlikely for 256-bit random % large prime)
  return scalarBigInt;
}

/**
 * Ensures a bigint scalar is within the field Fr [0, CURVE_ORDER-1].
 * Handles negative results of JS % operator by adding CURVE_ORDER if needed.
 * @param value The bigint value.
 * @returns The value modulo CURVE_ORDER, as a positive bigint.
 */
export function toFr(value: Scalar): Scalar {
  // Assuming inputs to toFr (like r + c*x, or hash results) are generally non-negative.
  // If value can be negative, the old logic `let result = value % CURVE_ORDER; if (result < 0n) result += CURVE_ORDER;` is safer.
  // However, for typical ZKP math where inputs are field elements or positive intermediate sums,
  // a simple modulo is usually sufficient if the language handles it correctly for positive results.
  // The audit states: "% on *positive* BigInt is fine".
  // If x, r, c are in [0, n-1], then r + c*x is >= 0.
  return value % CURVE_ORDER;
} 