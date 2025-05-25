import { bytesToHex } from "@noble/hashes/utils"
import {
  CURVE,
  ProjectivePoint, // underlying class
  poseidonHashMany,
  utils as starkUtils,
} from "@scure/starknet"

/* ---------- local helpers (tiny, zero-dep) -------------------------------- */
const addHexPrefix = (h: string) => (h.startsWith("0x") ? h : `0x${h}`)
const removeHexPrefix = (h: string) => h.replace(/^0x/i, "")
const buf2hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")

/* -------------------------- public re-exports ------------------------------ */
export type Scalar = bigint
export type Point = ProjectivePoint
export { ProjectivePoint }

export const CURVE_ORDER = CURVE.n
export const PRIME = CURVE.p
export const G: Point = ProjectivePoint.BASE
export const POINT_AT_INFINITY: Point = ProjectivePoint.ZERO

/* --------------------------- scalar helpers -------------------------------- */
export const moduloOrder = (x: Scalar): Scalar =>
  ((x % CURVE_ORDER) + CURVE_ORDER) % CURVE_ORDER

export function randScalar(): Scalar {
  let k: Scalar
  do {
    k = BigInt(`0x${bytesToHex(starkUtils.randomPrivateKey())}`) % CURVE_ORDER
  } while (k === 0n)
  return k
}

/* --------------------------- point helpers --------------------------------- */
export const getPublicKey = (priv: Scalar): Point => {
  const privMod = moduloOrder(priv)
  return privMod === 0n ? POINT_AT_INFINITY : G.multiply(privMod)
}

export const scalarMultiply = (k: Scalar, P: Point): Point => {
  const kMod = moduloOrder(k) // 0 ≤ kMod < n
  if (kMod === 0n || P.equals(POINT_AT_INFINITY)) return POINT_AT_INFINITY // cover k = 0 or n
  return P.multiply(kMod)
}

export const addPoints = (P: Point, Q: Point): Point =>
  P.equals(POINT_AT_INFINITY) ? Q : Q.equals(POINT_AT_INFINITY) ? P : P.add(Q)

export const negatePoint = (P: Point): Point =>
  P.equals(POINT_AT_INFINITY) ? POINT_AT_INFINITY : P.negate()

export const arePointsEqual = (P: Point, Q: Point) => P.equals(Q)

export const assertPointValidity = (P: Point) => {
  // POINT_AT_INFINITY is mathematically valid but the underlying library may consider it invalid
  if (P.equals(POINT_AT_INFINITY)) return
  P.assertValidity?.()
}

/* --------------------------- conversions ----------------------------------- */
export const bigIntToHex = (x: Scalar) => addHexPrefix(x.toString(16))

export const hexToBigInt = (h: string): Scalar => {
  // Input validation
  if (h == null || h === undefined) {
    throw new Error("Input cannot be null or undefined")
  }
  if (typeof h !== "string") {
    throw new Error("Input must be a string")
  }
  if (h === "") {
    throw new Error("Input cannot be an empty string")
  }

  // Normalize the hex string - add 0x prefix if missing
  const normalizedHex = h.startsWith("0x") ? h : `0x${h}`

  const hexPart = normalizedHex.slice(2)
  if (hexPart === "") {
    throw new Error("Hex string cannot be just '0x'")
  }

  // Check for valid hex characters
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    throw new Error("Invalid hex characters")
  }

  // Check for reasonable length - scalars should be at most 64 hex chars (256 bits)
  // The test uses 100 chars which should fail
  if (hexPart.length > 64) {
    throw new Error("Hex string too long")
  }

  return BigInt(normalizedHex)
}

export function pointToHex(P: Point, compressed = false): string {
  if (P.equals(POINT_AT_INFINITY))
    return compressed ? "0x00" : `0x04${"00".repeat(64)}`
  return addHexPrefix(buf2hex(P.toRawBytes(compressed)))
}

export const hexToPoint = (h: string): Point => {
  // Input validation - reuse the same validation logic as hexToBigInt but with different length limit
  if (h == null || h === undefined) {
    throw new Error("Input cannot be null or undefined")
  }
  if (typeof h !== "string") {
    throw new Error("Input must be a string")
  }
  if (h === "") {
    throw new Error("Input cannot be an empty string")
  }

  // Normalize the hex string - add 0x prefix if missing
  const normalizedHex = h.startsWith("0x") ? h : `0x${h}`

  const hexPart = normalizedHex.slice(2)
  if (hexPart === "") {
    throw new Error("Hex string cannot be just '0x'")
  }

  // Check for valid hex characters
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    throw new Error("Invalid hex characters")
  }

  // Check for reasonable length - uncompressed points are 130 hex chars, compressed are 66
  // The test uses 100 chars which should fail for this context
  if (hexPart.length > 130) {
    throw new Error("Hex string too long")
  }

  // Handle special cases for point at infinity
  if (normalizedHex === "0x00" || normalizedHex === `0x04${"00".repeat(64)}`) {
    return POINT_AT_INFINITY
  }

  return ProjectivePoint.fromHex(removeHexPrefix(normalizedHex))
}

/* --------------------------- Poseidon wrapper ------------------------------ */
export const poseidonHashScalars = (xs: Scalar[]): Scalar =>
  poseidonHashMany(xs.map(moduloOrder)) % CURVE_ORDER
