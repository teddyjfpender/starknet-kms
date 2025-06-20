// Re-export all types and functions from submodules
export * from "./errors"
export * from "./validation"
export * from "./scalar"
export * from "./point"
export * from "./hash"

// Import what we need for high-level helpers
import { type Scalar, moduloOrder, CURVE_ORDER } from "./scalar"
import { type Point, G, POINT_AT_INFINITY, scalarMultiply, PRIME, addPoints, negatePoint, arePointsEqual, assertPointValidity, pointToHex, hexToPoint } from "./point"
import { bigIntToHex, hexToBigInt, randScalar } from "./scalar"

/* --------------------------- high-level helpers --------------------------- */

/**
 * Derives a public key from a private key scalar
 * @param priv - Private key scalar
 * @returns Public key point (G * priv)
 */
export const getPublicKey = (priv: Scalar): Point => {
  const privMod = moduloOrder(priv)
  return privMod === 0n ? POINT_AT_INFINITY : scalarMultiply(privMod, G)
}

/* --------------------------- curve interface ------------------------------- */

/**
 * Interface for elliptic curve operations
 * This abstraction allows for future extensibility to other curves
 */
export interface Curve<CPoint, CScalar> {
  readonly order: CScalar
  readonly prime: CScalar
  readonly base: CPoint
  readonly zero: CPoint
  
  // Core operations
  add(P: CPoint, Q: CPoint): CPoint
  multiply(k: CScalar, P: CPoint): CPoint
  negate(P: CPoint): CPoint
  equals(P: CPoint, Q: CPoint): boolean
  isValid(P: CPoint): boolean
  
  // Conversions
  pointToHex(P: CPoint, compressed?: boolean): string
  hexToPoint(h: string): CPoint
  scalarToHex(k: CScalar): string
  hexToScalar(h: string): CScalar
  
  // High-level operations
  getPublicKey(priv: CScalar): CPoint
  randScalar(): CScalar
}

// Export the Starknet curve implementation
export const StarkCurve: Curve<Point, Scalar> = {
  order: CURVE_ORDER,
  prime: PRIME,
  base: G,
  zero: POINT_AT_INFINITY,
  
  add: addPoints,
  multiply: scalarMultiply,
  negate: negatePoint,
  equals: arePointsEqual,
  isValid: (P: Point) => {
    try {
      assertPointValidity(P)
      return true
    } catch {
      return false
    }
  },
  
  pointToHex,
  hexToPoint,
  scalarToHex: bigIntToHex,
  hexToScalar: hexToBigInt,
  
  getPublicKey,
  randScalar,
}
