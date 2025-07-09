import { CURVE, ProjectivePoint } from "@scure/starknet"
import { type Scalar, moduloOrder } from "./scalar"
import {
  addHexPrefix,
  assertStringHex,
  buf2hex,
  removeHexPrefix,
} from "./validation"

export type Point = ProjectivePoint
export { ProjectivePoint }

export const PRIME = (CURVE as any).p
export const G: Point = ProjectivePoint.BASE
export const POINT_AT_INFINITY: Point = ProjectivePoint.ZERO

/* --------------------------- point helpers --------------------------------- */

/**
 * Scalar multiplication: k * P
 * Handles edge cases properly (k=0, P=infinity)
 */
export const scalarMultiply = (k: Scalar, P: Point): Point => {
  const kMod = moduloOrder(k) // 0 ≤ kMod < n
  if (kMod === 0n || P.equals(POINT_AT_INFINITY)) return POINT_AT_INFINITY // cover k = 0 or n
  return P.multiply(kMod)
}

/**
 * Point addition: P + Q
 * Handles infinity points correctly
 */
export const addPoints = (P: Point, Q: Point): Point =>
  P.equals(POINT_AT_INFINITY) ? Q : Q.equals(POINT_AT_INFINITY) ? P : P.add(Q)

/**
 * Point negation: -P
 */
export const negatePoint = (P: Point): Point =>
  P.equals(POINT_AT_INFINITY) ? POINT_AT_INFINITY : P.negate()

/**
 * Point equality check
 */
export const arePointsEqual = (P: Point, Q: Point): boolean => P.equals(Q)

/**
 * Validates that a point is on the curve
 * POINT_AT_INFINITY is considered valid
 */
export const assertPointValidity = (P: Point): void => {
  // POINT_AT_INFINITY is mathematically valid but the underlying library may consider it invalid
  if (P.equals(POINT_AT_INFINITY)) return
  P.assertValidity?.()
}

/* --------------------------- conversions ----------------------------------- */

/**
 * Converts a point to hex string
 * @param P - Point to convert
 * @param compressed - Whether to use compressed format (33 bytes vs 65 bytes)
 * @returns Hex string representation
 */
export function pointToHex(P: Point, compressed = false): string {
  if (P.equals(POINT_AT_INFINITY))
    return compressed ? "0x00" : `0x04${"00".repeat(64)}`
  return addHexPrefix(buf2hex(P.toRawBytes(compressed)))
}

/**
 * Converts a hex string to a point
 * @param h - Hex string (with or without 0x prefix)
 * @returns Point
 * @throws InvalidHexError for invalid input
 */
export const hexToPoint = (h: string): Point => {
  // Uncompressed points are 130 hex chars, compressed are 66
  const normalizedHex = assertStringHex(h, 130)

  // Handle special cases for point at infinity
  if (normalizedHex === "0x00" || normalizedHex === `0x04${"00".repeat(64)}`) {
    return POINT_AT_INFINITY
  }

  return ProjectivePoint.fromHex(removeHexPrefix(normalizedHex))
}
